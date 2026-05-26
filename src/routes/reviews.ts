import { Env, CustomerReviewRow, CreateReviewInput } from '../types';
import { jsonResponse, errorResponse, paginatedResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';
import { markChangesPending } from './system';

// Transform a DB row into a clean API response object
function transformReview(row: CustomerReviewRow) {
  return {
    id: row.id,
    client_name: row.client_name,
    country: row.country,
    rating: row.rating,
    media_type: row.media_type,
    media_url: row.media_url,
    review_text_zh: row.review_text_zh,
    review_text_en: row.review_text_en,
    sort_order: row.sort_order,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/reviews — Public: only published reviews, sorted by sort_order DESC
export async function getReviews(request: Request, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT * FROM customer_reviews
     WHERE status = 'published'
     ORDER BY sort_order DESC, created_at DESC`
  ).all<CustomerReviewRow>();

  return jsonResponse((rows.results || []).map(transformReview), env, 200, request);
}

// GET /api/admin/reviews — Admin: all reviews with pagination & search
export async function getAdminReviews(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (status && (status === 'published' || status === 'draft')) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  if (search) {
    whereClauses.push('(client_name LIKE ? OR country LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const totalRes = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM customer_reviews ${whereString}`
  ).bind(...params).first<{ count: number }>();
  const total = totalRes?.count || 0;

  const rows = await env.DB.prepare(
    `SELECT * FROM customer_reviews ${whereString}
     ORDER BY sort_order DESC, created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all<CustomerReviewRow>();

  const data = (rows.results || []).map(transformReview);
  return paginatedResponse(data, page, pageSize, total, env, request);
}

// POST /api/admin/reviews — Admin: create a review
export async function createReview(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json() as CreateReviewInput;

  if (!input.client_name?.trim()) {
    return errorResponse('必填项缺失: client_name', env, 400);
  }
  if (!input.media_url?.trim()) {
    return errorResponse('必填项缺失: media_url', env, 400);
  }
  if (!input.review_text_zh?.trim() || !input.review_text_en?.trim()) {
    return errorResponse('必填项缺失: review_text_zh 和 review_text_en', env, 400);
  }
  if (!['video', 'image'].includes(input.media_type)) {
    return errorResponse('media_type 必须为 video 或 image', env, 400);
  }

  const rating = Math.min(5, Math.max(1, parseFloat(String(input.rating ?? 5))));

  // Get max sort_order for default ordering
  const maxOrder = await env.DB.prepare(
    'SELECT MAX(sort_order) as max_order FROM customer_reviews'
  ).first<{ max_order: number | null }>();
  const sortOrder = input.sort_order ?? ((maxOrder?.max_order ?? 0) + 1);

  const result = await env.DB.prepare(
    `INSERT INTO customer_reviews
       (client_name, country, rating, media_type, media_url, review_text_zh, review_text_en, sort_order, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    input.client_name.trim(),
    input.country?.trim() || null,
    rating,
    input.media_type,
    input.media_url.trim(),
    input.review_text_zh.trim(),
    input.review_text_en.trim(),
    sortOrder,
    input.status || 'published'
  ).run();

  await markChangesPending(env);
  return jsonResponse({ id: result.meta?.last_row_id, message: '创建成功' }, env, 201);
}

// PUT /api/admin/reviews/:id — Admin: update a review
export async function updateReview(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const reviewId = parseInt(id, 10);
  if (isNaN(reviewId)) return errorResponse('无效的 ID', env, 400);

  const existing = await env.DB.prepare(
    'SELECT id FROM customer_reviews WHERE id = ?'
  ).bind(reviewId).first<{ id: number }>();
  if (!existing) return errorResponse(`评价 ID ${id} 不存在`, env, 404);

  const input = await request.json() as Partial<CreateReviewInput>;
  const updates: string[] = [];
  const params: any[] = [];

  const fieldMap: Record<string, any> = {
    client_name: input.client_name?.trim(),
    country: input.country?.trim() || null,
    rating: input.rating !== undefined
      ? Math.min(5, Math.max(1, parseFloat(String(input.rating))))
      : undefined,
    media_type: input.media_type,
    media_url: input.media_url?.trim(),
    review_text_zh: input.review_text_zh?.trim(),
    review_text_en: input.review_text_en?.trim(),
    sort_order: input.sort_order,
    status: input.status,
  };

  Object.entries(fieldMap).forEach(([key, val]) => {
    if (val !== undefined) {
      updates.push(`${key} = ?`);
      params.push(val);
    }
  });

  if (updates.length === 0) {
    return errorResponse('没有可更新的字段', env, 400);
  }

  params.push(reviewId);
  await env.DB.prepare(
    `UPDATE customer_reviews SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(...params).run();

  await markChangesPending(env);
  return jsonResponse({ message: '更新成功' }, env);
}

// DELETE /api/admin/reviews/:id — Admin: delete a review
export async function deleteReview(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const reviewId = parseInt(id, 10);
  if (isNaN(reviewId)) return errorResponse('无效的 ID', env, 400);

  const existing = await env.DB.prepare(
    'SELECT id FROM customer_reviews WHERE id = ?'
  ).bind(reviewId).first<{ id: number }>();
  if (!existing) return errorResponse(`评价 ID ${id} 不存在`, env, 404);

  await env.DB.prepare('DELETE FROM customer_reviews WHERE id = ?').bind(reviewId).run();
  await markChangesPending(env);
  return jsonResponse({ message: '删除成功' }, env);
}
