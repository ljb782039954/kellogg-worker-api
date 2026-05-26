import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';
import { markChangesPending } from './system';
import type { BlogCategoryRow, CreateBlogCategoryInput, UpdateBlogCategoryInput } from '../types/api-input';

// ---- Helper: auto-generate slug from English name ----
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
}

/**
 * GET /api/blog-categories
 * Public — returns all categories with article count
 */
export async function getBlogCategories(request: Request, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT
      bc.*,
      COUNT(b.id) as article_count
    FROM blog_categories bc
    LEFT JOIN blogs b ON b.category = bc.name_en
    GROUP BY bc.id
    ORDER BY bc.sort_order ASC, bc.created_at ASC
  `).all<BlogCategoryRow>();

  return jsonResponse(rows.results || [], env, 200, request);
}

/**
 * POST /api/blog-categories
 * Admin — create a new category
 */
export async function createBlogCategory(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json() as CreateBlogCategoryInput;

  if (!input.name_zh || !input.name_en) {
    return errorResponse('缺少必填字段：name_zh 和 name_en', env, 400);
  }

  const slug = input.slug || toSlug(input.name_en);

  // Check slug uniqueness
  const existing = await env.DB.prepare(
    'SELECT id FROM blog_categories WHERE slug = ?'
  ).bind(slug).first();

  if (existing) {
    return errorResponse(`Slug "${slug}" 已存在，请更换名称或手动指定 slug`, env, 409);
  }

  // Get max sort_order
  const maxOrder = await env.DB.prepare(
    'SELECT MAX(sort_order) as max_order FROM blog_categories'
  ).first<{ max_order: number | null }>();
  const sortOrder = input.sort_order ?? ((maxOrder?.max_order ?? 0) + 1);

  const result = await env.DB.prepare(`
    INSERT INTO blog_categories (name_zh, name_en, slug, sort_order)
    VALUES (?, ?, ?, ?)
  `).bind(input.name_zh, input.name_en, slug, sortOrder).run();

  return jsonResponse({ id: result.meta?.last_row_id, message: '分类创建成功' }, env, 201);
}

/**
 * PUT /api/blog-categories/:id
 * Admin — update category, cascade-rename blogs if name_en changes
 */
export async function updateBlogCategory(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const categoryId = parseInt(id, 10);
  if (isNaN(categoryId)) return errorResponse('无效的分类 ID', env, 400);

  // Fetch current category
  const current = await env.DB.prepare(
    'SELECT * FROM blog_categories WHERE id = ?'
  ).bind(categoryId).first<BlogCategoryRow>();

  if (!current) return errorResponse(`分类 ID ${id} 不存在`, env, 404);

  const input = await request.json() as UpdateBlogCategoryInput;

  const newNameZh = input.name_zh ?? current.name_zh;
  const newNameEn = input.name_en ?? current.name_en;
  const newSlug = input.slug ?? (input.name_en ? toSlug(input.name_en) : current.slug);
  const newSortOrder = input.sort_order ?? current.sort_order;

  // Check slug uniqueness (exclude current)
  if (newSlug !== current.slug) {
    const slugConflict = await env.DB.prepare(
      'SELECT id FROM blog_categories WHERE slug = ? AND id != ?'
    ).bind(newSlug, categoryId).first();
    if (slugConflict) {
      return errorResponse(`Slug "${newSlug}" 已被其他分类使用`, env, 409);
    }
  }

  // Update category
  await env.DB.prepare(`
    UPDATE blog_categories
    SET name_zh = ?, name_en = ?, slug = ?, sort_order = ?
    WHERE id = ?
  `).bind(newNameZh, newNameEn, newSlug, newSortOrder, categoryId).run();

  // CASCADE: if English name changed, update all related blog articles
  if (newNameEn !== current.name_en) {
    const cascadeResult = await env.DB.prepare(`
      UPDATE blogs
      SET category = ?, updated_at = CURRENT_TIMESTAMP
      WHERE category = ?
    `).bind(newNameEn, current.name_en).run();
    console.log(`[BlogCategory] Cascade updated ${cascadeResult.meta?.changes ?? 0} articles from "${current.name_en}" to "${newNameEn}"`);
  }

  await markChangesPending(env);
  return jsonResponse({ message: '分类更新成功' }, env);
}

/**
 * DELETE /api/blog-categories/:id
 * Admin — delete category, PROTECTED if articles exist
 */
export async function deleteBlogCategory(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const categoryId = parseInt(id, 10);
  if (isNaN(categoryId)) return errorResponse('无效的分类 ID', env, 400);

  // Fetch category
  const category = await env.DB.prepare(
    'SELECT * FROM blog_categories WHERE id = ?'
  ).bind(categoryId).first<BlogCategoryRow>();

  if (!category) return errorResponse(`分类 ID ${id} 不存在`, env, 404);

  // Check if any articles are using this category
  const usageCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM blogs WHERE category = ?'
  ).bind(category.name_en).first<{ count: number }>();

  if (usageCount && usageCount.count > 0) {
    return errorResponse(
      `无法删除：该分类下有 ${usageCount.count} 篇文章，请先将这些文章移至其他分类后再删除。`,
      env,
      409
    );
  }

  await env.DB.prepare('DELETE FROM blog_categories WHERE id = ?').bind(categoryId).run();

  return jsonResponse({ message: '分类删除成功' }, env);
}
