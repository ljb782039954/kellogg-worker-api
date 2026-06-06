// 分类路由处理器
import { Env, CategoryRow } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';
import { transformCategory } from '../utils/transform';
import { markChangesPending } from './system';
import { updateMediaReferences } from '../utils/media';

// 获取所有分类
export async function getCategories(
  request: Request,
  env: Env
): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM categories ORDER BY sort_order ASC'
  ).all<CategoryRow>();

  const categories = results.map(row => transformCategory(row, env.ASSETS_BASE_URL));
  return jsonResponse(categories, env, 200, request);
}

// 获取单个分类
export async function getCategory(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const category = await env.DB.prepare(
    'SELECT * FROM categories WHERE id = ?'
  ).bind(id).first<CategoryRow>();

  if (!category) {
    return errorResponse('分类不存在', env, 404);
  }

  return jsonResponse(transformCategory(category, env.ASSETS_BASE_URL), env, 200, request);
}

// 创建分类
export async function createCategory(
  request: Request,
  env: Env
): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json() as any;

  if (!input.id || !input.name_zh || !input.name_en) {
    return errorResponse('缺少必填字段: id, name_zh, name_en', env, 400);
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM categories WHERE id = ?'
  ).bind(input.id).first();

  if (existing) {
    return errorResponse('分类 ID 已存在', env, 400);
  }

  await env.DB.prepare(
    'INSERT INTO categories (id, name_zh, name_en, image, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    input.id,
    input.name_zh,
    input.name_en,
    input.image || null,
    input.sort_order || 0
  ).run();

  await updateMediaReferences(env.DB, 'category', input.id, input.name_zh || input.name_en || '未命名分类', input);
  await markChangesPending(env);
  return jsonResponse({ id: input.id, message: '分类创建成功' }, env, 201);
}

// 更新分类
export async function updateCategory(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json() as any;

  const existing = await env.DB.prepare(
    'SELECT id FROM categories WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    return errorResponse('分类不存在', env, 404);
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (input.name_zh !== undefined) {
    updates.push('name_zh = ?');
    params.push(input.name_zh);
  }
  if (input.name_en !== undefined) {
    updates.push('name_en = ?');
    params.push(input.name_en);
  }
  if (input.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sort_order);
  }
  if (input.image !== undefined) {
    updates.push('image = ?');
    params.push(input.image);
  }

  if (updates.length > 0) {
    params.push(id);
    await env.DB.prepare(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  }

  const cat = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<CategoryRow>();
  if (cat) {
    await updateMediaReferences(env.DB, 'category', id, cat.name_zh || cat.name_en || '未命名分类', cat);
  }

  await markChangesPending(env);
  return jsonResponse({ message: '分类更新成功' }, env);
}

// 删除分类
export async function deleteCategory(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  if (id === 'all') {
    return errorResponse('不能删除默认分类', env, 400);
  }

  const result = await env.DB.prepare(
    'DELETE FROM categories WHERE id = ?'
  ).bind(id).run();

  if (result.meta.changes === 0) {
    return errorResponse('分类不存在', env, 404);
  }

  await updateMediaReferences(env.DB, 'category', id, '', null);
  await markChangesPending(env);
  return jsonResponse({ message: '分类删除成功' }, env);
}
