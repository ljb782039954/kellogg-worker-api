import type { Env, InquiryRow } from '../types';
import { jsonResponse, errorResponse, paginatedResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';
import { InquiryValidationError, normalizeInquiryInput, verifyTurnstileToken } from '../utils/inquirySecurity';
import { buildInquiryFilters } from '../utils/inquiryFilters';

export async function submitInquiry(request: Request, env: Env): Promise<Response> {
  try {
    const input = normalizeInquiryInput(await request.json());
    if (!env.TURNSTILE_SECRET_KEY) {
      console.error(JSON.stringify({ message: 'TURNSTILE_SECRET_KEY is not configured' }));
      return errorResponse('Verification service is not configured', env, 503);
    }

    const sourceIp = request.headers.get('CF-Connecting-IP')
      || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
    const allowedHostnames = (env.TURNSTILE_ALLOWED_HOSTNAMES || 'kelloggfashion.com,www.kelloggfashion.com,localhost,127.0.0.1')
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);
    const verification = await verifyTurnstileToken({
      token: input.turnstileToken,
      secret: env.TURNSTILE_SECRET_KEY,
      remoteIp: sourceIp,
      allowedHostnames,
    });
    if (!verification.success) return errorResponse('Human verification failed', env, 400);

    if (sourceIp) {
      const recentByIp = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM inquiries
         WHERE source_ip = ? AND created_at >= datetime('now', '-10 minutes')`
      ).bind(sourceIp).first<{ count: number }>();
      if ((recentByIp?.count || 0) >= 5) {
        return errorResponse('Too many inquiry submissions', env, 429);
      }
    }

    const duplicate = await env.DB.prepare(
      `SELECT id FROM inquiries
       WHERE email = ? AND message = ? AND created_at >= datetime('now', '-5 minutes')
       LIMIT 1`
    ).bind(input.email, input.message).first<{ id: number }>();
    if (duplicate) return errorResponse('Duplicate inquiry submission', env, 409);

    await env.DB.prepare(
      `INSERT INTO inquiries (name, email, phone, country, company, product_type, quantity, message, source_ip, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      input.name,
      input.email,
      input.phone || null,
      input.country || null,
      input.company || null,
      input.product_type || null,
      input.quantity || null,
      input.message,
      sourceIp || null,
    ).run();

    return jsonResponse({ message: 'Inquiry submitted successfully' }, env, 201);
  } catch (error) {
    if (error instanceof InquiryValidationError || error instanceof SyntaxError) {
      return errorResponse(error.message || 'Invalid inquiry data', env, 400);
    }
    console.error(JSON.stringify({
      message: 'Submit inquiry failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    return errorResponse('Submission failed, please try again later', env, 500);
  }
}

export async function getInquiries(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const { whereString, params } = buildInquiryFilters(url.searchParams);
  const offset = (page - 1) * pageSize;
  const totalRes = await env.DB.prepare(`SELECT COUNT(*) AS count FROM inquiries ${whereString}`)
    .bind(...params)
    .first<{ count: number }>();
  const results = await env.DB.prepare(
    `SELECT * FROM inquiries ${whereString} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, pageSize, offset).all<InquiryRow>();

  return paginatedResponse(results.results, page, pageSize, totalRes?.count || 0, env, request);
}

export async function updateInquiryStatus(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const { status } = await request.json() as { status: string };
  if (!['pending', 'processed'].includes(status)) return errorResponse('Invalid status', env, 400);

  await env.DB.prepare('UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, id)
    .run();
  return jsonResponse({ message: 'Inquiry status updated' }, env);
}

export async function deleteInquiry(request: Request, env: Env, id: string): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(id).run();
  return jsonResponse({ message: 'Inquiry deleted' }, env);
}
