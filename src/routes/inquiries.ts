import { Env, InquiryRow, CreateInquiryInput } from '../types';
import { jsonResponse, errorResponse, paginatedResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';

/**
 * 提交询盘 (公开接口)
 */
export async function submitInquiry(request: Request, env: Env): Promise<Response> {
  const input = await request.json() as CreateInquiryInput;

  if (!input.name || !input.email || !input.message) {
    return errorResponse('姓名、邮箱和消息内容为必填项', env, 400);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO inquiries (name, email, phone, country, company, product_type, quantity, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      input.name,
      input.email,
      input.phone || null,
      input.country || null,
      input.company || null,
      input.product_type || null,
      input.quantity || null,
      input.message
    ).run();

    return jsonResponse({ message: '询盘已提交，我们会尽快与您联系' }, env, 201);
  } catch (err) {
    console.error('Submit inquiry failed:', err);
    return errorResponse('提交失败，请稍后重试', env, 500);
  }
}

/**
 * 获取询盘列表 (管理员接口)
 */
export async function getInquiries(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
  const status = url.searchParams.get('status'); // optional filter

  let whereClauses = [];
  let params: any[] = [];

  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  const totalRes = await env.DB.prepare(`SELECT COUNT(*) as count FROM inquiries ${whereString}`).bind(...params).first<any>();
  const total = totalRes?.count || 0;

  const results = await env.DB.prepare(
    `SELECT * FROM inquiries ${whereString} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all<InquiryRow>();

  return paginatedResponse(results.results, page, pageSize, total, env, request);
}

/**
 * 更新询盘状态 (管理员接口)
 */
export async function updateInquiryStatus(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const { status } = await request.json() as { status: string };
  if (!['pending', 'processed'].includes(status)) {
    return errorResponse('无效的状态值', env, 400);
  }

  await env.DB.prepare('UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, id)
    .run();

  return jsonResponse({ message: '状态更新成功' }, env);
}

/**
 * 删除询盘 (管理员接口)
 */
export async function deleteInquiry(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(id).run();
  return jsonResponse({ message: '询盘已删除' }, env);
}
