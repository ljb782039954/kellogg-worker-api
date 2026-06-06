import { Env, ProductRow, ProductImageRow, ProductSizeRow, ProductColorRow, ProductCustomFieldRow, ProductVideoRow } from '../types';
import { jsonResponse, errorResponse, paginatedResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';
import { transformProduct } from '../utils/transform';
import { markChangesPending } from './system';
import { updateMediaReferences } from '../utils/media';

export async function getProducts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
  const category = url.searchParams.get('category');
  const isFeatured = url.searchParams.get('featured') === 'true';
  const sort = url.searchParams.get('sort') || 'newest';

  let whereClauses = [];
  let params: any[] = [];

  if (category && category !== 'all') {
    whereClauses.push('category_id = ?');
    params.push(category);
  }
  if (isFeatured) {
    whereClauses.push('is_featured = 1');
  }

  // 只有当明确验证通过（返回 null）且环境中有配置 Token 时，才展示全部商品
  // 否则（验证失败或者是未配置 Token），一律视为普通用户，进行上架状态过滤
  const authError = verifyAdminToken(request, env);
  if (authError || !env.ADMIN_TOKEN) {
    whereClauses.push('is_active = 1');
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let orderBy = 'created_at DESC';
  if (sort === 'price-asc') orderBy = 'price ASC';
  else if (sort === 'price-desc') orderBy = 'price DESC';
  else if (sort === 'popular') orderBy = 'sales DESC';

  const offset = (page - 1) * pageSize;

  // 查总数
  const totalRes = await env.DB.prepare(`SELECT COUNT(*) as count FROM products ${whereString}`).bind(...params).first<any>();
  const total = totalRes?.count || 0;

  // 查列表
  const productsRows = await env.DB.prepare(
    `SELECT * FROM products ${whereString} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all<ProductRow>();

  // 查询对应的所有副图、尺寸、颜色
  const { results: imageRows } = await env.DB.prepare(
    `SELECT * FROM product_images ORDER BY sort_order ASC`
  ).all<ProductImageRow>();

  const { results: sizeRows } = await env.DB.prepare(
    `SELECT * FROM product_sizes ORDER BY sort_order ASC`
  ).all<ProductSizeRow>();

  const { results: colorRows } = await env.DB.prepare(
    `SELECT * FROM product_colors ORDER BY sort_order ASC`
  ).all<ProductColorRow>();

  const { results: customFieldRows } = await env.DB.prepare(
    `SELECT * FROM product_custom_fields ORDER BY sort_order ASC`
  ).all<ProductCustomFieldRow>();

  const { results: videoRows } = await env.DB.prepare(
    `SELECT * FROM product_videos ORDER BY sort_order ASC`
  ).all<ProductVideoRow>();

  const transformed = productsRows.results.map(row => transformProduct(row, imageRows, sizeRows, colorRows, customFieldRows, videoRows, env.ASSETS_BASE_URL));

  return paginatedResponse(transformed, page, pageSize, total, env, request);
}

export async function getProduct(request: Request, env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>();
  if (!row) return errorResponse('商品不存在', env, 404);

  // 鉴权判断
  const authError = verifyAdminToken(request, env);
  const isAdmin = !authError && !!env.ADMIN_TOKEN;

  if (!isAdmin && row.is_active === 0) {
    return errorResponse('商品已下架', env, 404);
  }

  const images = await env.DB.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC').bind(id).all<ProductImageRow>();
  const sizes = await env.DB.prepare('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order ASC').bind(id).all<ProductSizeRow>();
  const colors = await env.DB.prepare('SELECT * FROM product_colors WHERE product_id = ? ORDER BY sort_order ASC').bind(id).all<ProductColorRow>();
  const customFields = await env.DB.prepare('SELECT * FROM product_custom_fields WHERE product_id = ? ORDER BY sort_order ASC').bind(id).all<ProductCustomFieldRow>();
  const videos = await env.DB.prepare('SELECT * FROM product_videos WHERE product_id = ? ORDER BY sort_order ASC').bind(id).all<ProductVideoRow>();

  return jsonResponse(transformProduct(row, images.results, sizes.results, colors.results, customFields.results, videos.results, env.ASSETS_BASE_URL), env, 200, request);
}

export async function createProduct(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json() as any;
  if (!input.name_zh || !input.name_en || !input.price) {
    return errorResponse('必填项缺失', env, 400);
  }

  const result = await env.DB.prepare(
    `INSERT INTO products (name_zh, name_en, price, original_price, bulk_prices, image, category_id, rating, sales, tag_zh, tag_en, description_zh, description_en, fabric_zh, fabric_en, notes_zh, notes_en, release_date, is_featured, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    input.name_zh, input.name_en, input.price, input.original_price || null,
    JSON.stringify(input.bulk_prices || []),
    input.image || null, input.category_id || null, input.rating || 5.0,
    input.sales || 0, input.tag_zh || null, input.tag_en || null,
    input.description_zh || null, input.description_en || null,
    input.fabric_zh || null, input.fabric_en || null,
    input.notes_zh || null, input.notes_en || null,
    input.release_date || null, input.is_featured ? 1 : 0, input.is_active !== false ? 1 : 0, input.sort_order || 0
  ).run();

  const productId = result.meta.last_row_id;

  // 如果有副图
  if (input.images && Array.isArray(input.images)) {
    for (let i = 0; i < input.images.length; i++) {
      await env.DB.prepare('INSERT INTO product_images (product_id, image_key, sort_order) VALUES (?, ?, ?)')
        .bind(productId, input.images[i], i)
        .run();
    }
  }

  // 如果有尺寸
  if (input.sizes && Array.isArray(input.sizes)) {
    for (let i = 0; i < input.sizes.length; i++) {
      await env.DB.prepare('INSERT INTO product_sizes (product_id, name, image, sort_order) VALUES (?, ?, ?, ?)')
        .bind(productId, input.sizes[i].name, input.sizes[i].image || null, i)
        .run();
    }
  }

  // 如果有颜色
  if (input.colors && Array.isArray(input.colors)) {
    for (let i = 0; i < input.colors.length; i++) {
      await env.DB.prepare('INSERT INTO product_colors (product_id, name_zh, name_en, image, sort_order) VALUES (?, ?, ?, ?, ?)')
        .bind(productId, input.colors[i].name_zh, input.colors[i].name_en, input.colors[i].image || null, i)
        .run();
    }
  }

  // 如果有自定义字段
  if (input.custom_fields && Array.isArray(input.custom_fields)) {
    for (let i = 0; i < input.custom_fields.length; i++) {
      await env.DB.prepare('INSERT INTO product_custom_fields (product_id, name_zh, name_en, value_zh, value_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(productId, input.custom_fields[i].name_zh, input.custom_fields[i].name_en, input.custom_fields[i].value_zh, input.custom_fields[i].value_en, i)
        .run();
    }
  }

  // 如果有视频
  if (input.videos && Array.isArray(input.videos)) {
    for (let i = 0; i < input.videos.length; i++) {
      if (input.videos[i]) {
        await env.DB.prepare('INSERT INTO product_videos (product_id, video_url, sort_order) VALUES (?, ?, ?)')
          .bind(productId, input.videos[i], i)
          .run();
      }
    }
  }

  await updateMediaReferences(env.DB, 'product', productId.toString(), input.name_zh || input.name_en || '未命名商品', input);
  await markChangesPending(env);
  return jsonResponse({ id: productId, message: '创建成功' }, env, 201);
}

export async function updateProduct(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json() as any;
  const productId = parseInt(id);

  const updates: string[] = [];
  const params: any[] = [];

  const fields = ['name_zh', 'name_en', 'price', 'original_price', 'bulk_prices', 'image', 'category_id', 'rating', 'sales', 'tag_zh', 'tag_en', 'description_zh', 'description_en', 'fabric_zh', 'fabric_en', 'notes_zh', 'notes_en', 'release_date', 'sort_order'];
  fields.forEach(f => {
    if (input[f] !== undefined) {
      updates.push(`${f} = ?`);
      let val = input[f];
      if (f === 'bulk_prices') val = JSON.stringify(val);
      params.push(val);
    }
  });

  if (input.is_featured !== undefined) {
    updates.push('is_featured = ?');
    params.push(input.is_featured ? 1 : 0);
  }

  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(input.is_active ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(productId);
    await env.DB.prepare(`UPDATE products SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...params).run();
  }

  // 更新图片库
  if (input.images !== undefined) {
    await env.DB.prepare('DELETE FROM product_images WHERE product_id = ?').bind(productId).run();
    if (Array.isArray(input.images)) {
      for (let i = 0; i < input.images.length; i++) {
        await env.DB.prepare('INSERT INTO product_images (product_id, image_key, sort_order) VALUES (?, ?, ?)')
          .bind(productId, input.images[i], i)
          .run();
      }
    }
  }

  // 更新尺寸
  if (input.sizes !== undefined) {
    await env.DB.prepare('DELETE FROM product_sizes WHERE product_id = ?').bind(productId).run();
    if (Array.isArray(input.sizes)) {
      for (let i = 0; i < input.sizes.length; i++) {
        await env.DB.prepare('INSERT INTO product_sizes (product_id, name, image, sort_order) VALUES (?, ?, ?, ?)')
          .bind(productId, input.sizes[i].name, input.sizes[i].image || null, i)
          .run();
      }
    }
  }

  // 更新颜色
  if (input.colors !== undefined) {
    await env.DB.prepare('DELETE FROM product_colors WHERE product_id = ?').bind(productId).run();
    if (Array.isArray(input.colors)) {
      for (let i = 0; i < input.colors.length; i++) {
        await env.DB.prepare('INSERT INTO product_colors (product_id, name_zh, name_en, image, sort_order) VALUES (?, ?, ?, ?, ?)')
          .bind(productId, input.colors[i].name_zh, input.colors[i].name_en, input.colors[i].image || null, i)
          .run();
      }
    }
  }

  // 更新自定义参数
  if (input.custom_fields !== undefined) {
    await env.DB.prepare('DELETE FROM product_custom_fields WHERE product_id = ?').bind(productId).run();
    if (Array.isArray(input.custom_fields)) {
      for (let i = 0; i < input.custom_fields.length; i++) {
        await env.DB.prepare('INSERT INTO product_custom_fields (product_id, name_zh, name_en, value_zh, value_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(productId, input.custom_fields[i].name_zh, input.custom_fields[i].name_en, input.custom_fields[i].value_zh, input.custom_fields[i].value_en, i)
          .run();
      }
    }
  }

  // 更新视频
  if (input.videos !== undefined) {
    await env.DB.prepare('DELETE FROM product_videos WHERE product_id = ?').bind(productId).run();
    if (Array.isArray(input.videos)) {
      for (let i = 0; i < input.videos.length; i++) {
        if (input.videos[i]) {
          await env.DB.prepare('INSERT INTO product_videos (product_id, video_url, sort_order) VALUES (?, ?, ?)')
            .bind(productId, input.videos[i], i)
            .run();
        }
      }
    }
  }

  // Update media references based on complete updated product
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<ProductRow>();
  if (row) {
    const images = await env.DB.prepare('SELECT * FROM product_images WHERE product_id = ?').bind(productId).all<ProductImageRow>();
    const sizes = await env.DB.prepare('SELECT * FROM product_sizes WHERE product_id = ?').bind(productId).all<ProductSizeRow>();
    const colors = await env.DB.prepare('SELECT * FROM product_colors WHERE product_id = ?').bind(productId).all<ProductColorRow>();
    const videos = await env.DB.prepare('SELECT * FROM product_videos WHERE product_id = ?').bind(productId).all<ProductVideoRow>();
    const fullProduct = { ...row, images: images.results, sizes: sizes.results, colors: colors.results, videos: videos.results };
    
    await updateMediaReferences(env.DB, 'product', productId.toString(), row.name_zh || row.name_en || '未命名商品', fullProduct);
  }

  await markChangesPending(env);
  return jsonResponse({ message: '更新成功' }, env);
}

export async function deleteProduct(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  await updateMediaReferences(env.DB, 'product', id, '', null);
  await markChangesPending(env);
  return jsonResponse({ message: '删除成功' }, env);
}
