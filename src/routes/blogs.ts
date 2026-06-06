import { Env, BlogRow, CreateBlogInput } from '../types';
import { jsonResponse, errorResponse, paginatedResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';
import { markChangesPending } from './system';
import { updateMediaReferences } from '../utils/media';

// Transform a raw DB row into a clean blog object for API response
function transformBlog(row: BlogRow) {
  return {
    id: row.id,
    slug: row.slug,
    title_zh: row.title_zh,
    title_en: row.title_en,
    summary_zh: row.summary_zh,
    summary_en: row.summary_en,
    content_zh: row.content_zh,
    content_en: row.content_en,
    cover_image: row.cover_image,
    category: row.category,
    tags: safeParseJson(row.tags, []),
    author: row.author,
    status: row.status,
    seo_title_zh: row.seo_title_zh,
    seo_title_en: row.seo_title_en,
    seo_desc_zh: row.seo_desc_zh,
    seo_desc_en: row.seo_desc_en,
    publish_date: row.publish_date,
    view_count: row.view_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Transform for list view - omit heavy content fields
function transformBlogSummary(row: BlogRow) {
  const full = transformBlog(row);
  const { content_zh, content_en, ...summary } = full;
  return summary;
}

function safeParseJson(val: string | null, fallback: any = null) {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// GET /api/blogs - Public list with pagination and filtering
export async function getBlogs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '10')));
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  const sort = url.searchParams.get('sort') || 'newest';

  // Determine if requester is admin
  const authError = verifyAdminToken(request, env);
  const isAdmin = !authError && !!env.ADMIN_TOKEN;

  const whereClauses: string[] = [];
  const params: any[] = [];

  // Public requests can only see published articles
  if (!isAdmin) {
    whereClauses.push("status = 'published'");
  } else {
    // Admin can filter by status
    const status = url.searchParams.get('status');
    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }
  }

  if (category && category !== 'all') {
    whereClauses.push('category = ?');
    params.push(category);
  }

  // Tag filter using JSON array search
  if (tag) {
    whereClauses.push(`tags LIKE ?`);
    params.push(`%"${tag}"%`);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let orderBy = 'publish_date DESC, created_at DESC';
  if (sort === 'popular') orderBy = 'view_count DESC, publish_date DESC';
  else if (sort === 'oldest') orderBy = 'publish_date ASC, created_at ASC';

  const offset = (page - 1) * pageSize;

  // Count total matching rows
  const totalRes = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM blogs ${whereString}`
  ).bind(...params).first<any>();
  const total = totalRes?.count || 0;

  // Fetch paginated rows (without heavy content fields)
  const rows = await env.DB.prepare(
    `SELECT id, slug, title_zh, title_en, summary_zh, summary_en, cover_image, category, tags, author, status, publish_date, view_count, created_at, updated_at
     FROM blogs ${whereString} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all<BlogRow>();

  const data = (rows.results || []).map(transformBlogSummary);
  return paginatedResponse(data, page, pageSize, total, env, request);
}

// GET /api/blogs/:idOrSlug - Public single blog detail
export async function getBlog(request: Request, env: Env, idOrSlug: string): Promise<Response> {
  // Determine if requester is admin
  const authError = verifyAdminToken(request, env);
  const isAdmin = !authError && !!env.ADMIN_TOKEN;

  // Try by numeric ID first, then by slug
  let row: BlogRow | null = null;
  if (/^\d+$/.test(idOrSlug)) {
    row = await env.DB.prepare('SELECT * FROM blogs WHERE id = ?').bind(idOrSlug).first<BlogRow>();
  } else {
    row = await env.DB.prepare('SELECT * FROM blogs WHERE slug = ?').bind(idOrSlug).first<BlogRow>();
  }

  if (!row) return errorResponse('文章不存在', env, 404);

  // Non-admin can only read published articles
  if (!isAdmin && row.status !== 'published') {
    return errorResponse('文章不存在或未发布', env, 404);
  }

  // Increment view count for public (non-admin) reads asynchronously
  if (!isAdmin) {
    env.DB.prepare('UPDATE blogs SET view_count = view_count + 1 WHERE id = ?')
      .bind(row.id)
      .run()
      .catch(() => {}); // Fire-and-forget, do not block response
  }

  return jsonResponse(transformBlog(row), env, 200, request);
}

// POST /api/blogs - Create a new blog article (admin only)
export async function createBlog(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json() as CreateBlogInput;

  if (!input.slug || !input.title_zh || !input.title_en) {
    return errorResponse('必填项缺失: slug, title_zh, title_en', env, 400);
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    return errorResponse('Slug 只能包含小写字母、数字和连字符', env, 400);
  }

  const tagsJson = JSON.stringify(Array.isArray(input.tags) ? input.tags : []);

  try {
    const result = await env.DB.prepare(
      `INSERT INTO blogs (slug, title_zh, title_en, summary_zh, summary_en, content_zh, content_en,
        cover_image, category, tags, author, status, seo_title_zh, seo_title_en, seo_desc_zh, seo_desc_en, publish_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      input.slug,
      input.title_zh,
      input.title_en,
      input.summary_zh || null,
      input.summary_en || null,
      input.content_zh || '',
      input.content_en || '',
      input.cover_image || null,
      input.category || null,
      tagsJson,
      input.author || 'Admin',
      input.status || 'draft',
      input.seo_title_zh || null,
      input.seo_title_en || null,
      input.seo_desc_zh || null,
      input.seo_desc_en || null,
      input.publish_date || null,
    ).run();

    const blogId = result.meta.last_row_id;
    await updateMediaReferences(env.DB, 'blog', blogId.toString(), input.title_zh || input.title_en || '未命名博客', input);
    await markChangesPending(env);
    return jsonResponse({ id: blogId, message: '创建成功' }, env, 201);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) {
      return errorResponse(`Slug "${input.slug}" 已存在，请更换`, env, 409);
    }
    throw err;
  }
}

// PUT /api/blogs/:id - Update a blog article (admin only)
export async function updateBlog(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const blogId = parseInt(id);
  const existing = await env.DB.prepare('SELECT id FROM blogs WHERE id = ?').bind(blogId).first<BlogRow>();
  if (!existing) return errorResponse('文章不存在', env, 404);

  const input = await request.json() as Partial<CreateBlogInput>;

  const updates: string[] = [];
  const params: any[] = [];

  const textFields = ['slug', 'title_zh', 'title_en', 'summary_zh', 'summary_en', 'content_zh', 'content_en',
    'cover_image', 'category', 'author', 'status', 'seo_title_zh', 'seo_title_en',
    'seo_desc_zh', 'seo_desc_en', 'publish_date'];

  textFields.forEach(field => {
    if (field in input) {
      updates.push(`${field} = ?`);
      params.push((input as any)[field] ?? null);
    }
  });

  if ('tags' in input) {
    updates.push('tags = ?');
    params.push(JSON.stringify(Array.isArray(input.tags) ? input.tags : []));
  }

  if (updates.length === 0) {
    return errorResponse('没有可更新的字段', env, 400);
  }

  params.push(blogId);
  await env.DB.prepare(
    `UPDATE blogs SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(...params).run();

  const blog = await env.DB.prepare('SELECT * FROM blogs WHERE id = ?').bind(blogId).first<BlogRow>();
  if (blog) {
    await updateMediaReferences(env.DB, 'blog', blogId.toString(), blog.title_zh || blog.title_en || '未命名博客', blog);
  }

  await markChangesPending(env);
  return jsonResponse({ message: '更新成功' }, env);
}

// DELETE /api/blogs/:id - Delete a blog article (admin only)
export async function deleteBlog(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const blogId = parseInt(id);
  const existing = await env.DB.prepare('SELECT id FROM blogs WHERE id = ?').bind(blogId).first<BlogRow>();
  if (!existing) return errorResponse('文章不存在', env, 404);

  await env.DB.prepare('DELETE FROM blogs WHERE id = ?').bind(blogId).run();
  await updateMediaReferences(env.DB, 'blog', blogId.toString(), '', null);
  await markChangesPending(env);
  return jsonResponse({ message: '删除成功' }, env);
}
