// 配置管理路由处理器 - 加入 Bootstrap 兜底逻辑
import { Env, CustomPage, CompanyInfo, HeaderContent, FooterContent } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';

/**
 * 默认配置 (Bootstrap Data)
 * 确保 KV 为空时，前端依然可以拉取到基础结构并保持显示
 */

// ============================================
// 核心路由处理
// ============================================

/**
 * 通用获取配置 (按键名)
 */
export async function getConfig(
  request: Request,
  env: Env,
  key: string
): Promise<Response> {
  const value = await env.KELLOGG_FRONTEND_CONFIG.get(key, 'json');

  if (value === null) {
    // 返回空对象以代替曾经硬编码的默认兜底数据，允许前端处理为空状态
    if (key === 'site_settings' || key === 'header_config' || key === 'footer_config') {
      return jsonResponse({}, env);
    }
    if (key === 'pages') return jsonResponse([], env);
    
    return errorResponse(`配置项 ${key} 不存在`, env, 404);
  }

  return jsonResponse(value, env, 200, request);
}

/**
 * 保存配置
 */
export async function setConfig(
  request: Request,
  env: Env
): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const { key, value } = await request.json() as { key: string; value: unknown };

  if (!key) return errorResponse('缺少配置 key', env, 400);

  await env.KELLOGG_FRONTEND_CONFIG.put(key, JSON.stringify(value));
  return jsonResponse({ message: '配置保存成功', key }, env);
}

/**
 * 删除配置
 */
export async function deleteConfig(
  request: Request,
  env: Env,
  key: string
): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  if (!key) return errorResponse('缺少配置 key', env, 400);

  await env.KELLOGG_FRONTEND_CONFIG.delete(key);
  return jsonResponse({ message: '配置删除成功', key }, env);
}

// --------------------------------------------
// 页面管理
// --------------------------------------------

export async function getPages(request: Request, env: Env): Promise<Response> {
  // 优先尝试获取轻量级索引，如果不存在则退回到旧版全量数据
  let pages = await env.KELLOGG_FRONTEND_CONFIG.get('pages_index', 'json') as any;
  if (!pages) {
    pages = await env.KELLOGG_FRONTEND_CONFIG.get('pages', 'json') as CustomPage[] | null;
  }
  const rawPages: any[] = pages || [];

  // 数据兼容性处理：如果旧数据缺失 seo 字段，自动根据标题补全
  const patchedPages = rawPages.map(page => ({
    ...page,
    seo: page.seo || {
      title: { 
        zh: `${page.title?.zh || ''} | KELLOGG`, 
        en: `${page.title?.en || ''} | KELLOGG` 
      },
      description: { zh: '', en: '' }
    }
  }));

  return jsonResponse(patchedPages, env, 200, request);
}

export async function getPageById(request: Request, env: Env, id: string): Promise<Response> {
  // 优先尝试获取分片详情
  let pageData = await env.KELLOGG_FRONTEND_CONFIG.get(`page:${id}`, 'json');
  
  // 兼容逻辑：如果没有找到分片详情，退回到从旧版 pages 数组中查找
  if (!pageData) {
    const pages = await env.KELLOGG_FRONTEND_CONFIG.get('pages', 'json') as CustomPage[] | null;
    const rawPages = pages || [];
    const targetPage = rawPages.find(p => p.id === id);
    
    if (!targetPage) {
      return errorResponse(`Page ${id} not found`, env, 404);
    }
    pageData = targetPage;
  }

  return jsonResponse(pageData, env, 200, request);
}

export async function updatePages(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const pages = await request.json();
  await env.KELLOGG_FRONTEND_CONFIG.put('pages', JSON.stringify(pages));
  return jsonResponse({ message: '页面配置更新成功' }, env);
}

// --------------------------------------------
// 站点设置
// --------------------------------------------

export async function getSiteSettings(request: Request, env: Env): Promise<Response> {
  const settings = await env.KELLOGG_FRONTEND_CONFIG.get('site_settings', 'json');
  return jsonResponse(settings || {}, env, 200, request);
}

export async function updateSiteSettings(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const input = await request.json();
  await env.KELLOGG_FRONTEND_CONFIG.put('site_settings', JSON.stringify(input));
  return jsonResponse({ message: '站点设置更新成功' }, env);
}

// --------------------------------------------
// 其他工具
// --------------------------------------------

export async function listConfigKeys(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const listed = await env.KELLOGG_FRONTEND_CONFIG.list();
  return jsonResponse({ keys: listed.keys.map(k => k.name) }, env);
}

export async function batchGetConfig(request: Request, env: Env): Promise<Response> {
  const { keys } = await request.json() as { keys: string[] };
  if (!keys || !Array.isArray(keys)) return errorResponse('缺少 keys', env, 400);

  const results: Record<string, unknown> = {};
  for (const key of keys) {
    const val = await env.KELLOGG_FRONTEND_CONFIG.get(key, 'json');
    if (val) results[key] = val;
  }
  return jsonResponse(results, env);
}
