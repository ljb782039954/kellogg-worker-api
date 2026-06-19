// 配置管理路由处理器 - 加入 Bootstrap 兜底逻辑
import { Env, CustomPage, CompanyInfo, HeaderContent, FooterContent } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';
import { markChangesPending } from './system';
import { updateMediaReferences } from '../utils/media';

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

  // Update media references for KV config items
  if (key.startsWith('page:')) {
    const pageVal = value as any;
    const titleObj = pageVal.title || {};
    const title = typeof titleObj === 'string' ? titleObj : (titleObj.zh || titleObj.en || '未命名页面');
    await updateMediaReferences(env.DB, 'page', key, `页面: ${title}`, value);
  } else if (key === 'site_settings') {
    await updateMediaReferences(env.DB, 'global', key, '公司全局配置', value);
  } else if (key === 'header_config') {
    await updateMediaReferences(env.DB, 'global', key, '顶部导航栏', value);
  } else if (key === 'footer_config') {
    await updateMediaReferences(env.DB, 'global', key, '页脚配置', value);
  }

  await markChangesPending(env);
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

  // Clear media references
  if (key.startsWith('page:') || key === 'site_settings' || key === 'header_config' || key === 'footer_config') {
    const type = key.startsWith('page:') ? 'page' : 'global';
    await updateMediaReferences(env.DB, type, key, '', null);
  }

  await markChangesPending(env);
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

  // 并发读取各页面详情，动态提取真实的 blockCount，并在缺少 SEO 字段时自动根据标题补全
  const patchedPages = await Promise.all(
    rawPages.map(async (page) => {
      if (page.type !== 'fixed-layout') {
        try {
          const pageDetail = await env.KELLOGG_FRONTEND_CONFIG.get(`page:${page.id}`, 'json') as any;
          if (pageDetail) {
            return {
              ...page,
              blockCount: pageDetail.blocks?.length ?? 0,
              seo: page.seo || pageDetail.seo || {
                title: { 
                  zh: `${page.title?.zh || ''} | KELLOGG`, 
                  en: `${page.title?.en || ''} | KELLOGG` 
                },
                description: { zh: '', en: '' }
              }
            };
          }
        } catch (e) {
          console.error(`Failed to load block count for page ${page.id}:`, e);
        }
      }
      return {
        ...page,
        blockCount: 0,
        seo: page.seo || {
          title: { 
            zh: `${page.title?.zh || ''} | KELLOGG`, 
            en: `${page.title?.en || ''} | KELLOGG` 
          },
          description: { zh: '', en: '' }
        }
      };
    })
  );

  return jsonResponse(patchedPages, env, 200, request);
}

export async function getPageById(request: Request, env: Env, id: string): Promise<Response> {
  // 优先尝试获取分片详情
  let pageData = await env.KELLOGG_FRONTEND_CONFIG.get(`page:${id}`, 'json');
  
  // 兼容逻辑：如果分片详情不存在，尝试从 pages_index 查找 (处理 fixed-layout 页面或未完全拆分的缓存数据)
  if (!pageData) {
    const pagesIndex = await env.KELLOGG_FRONTEND_CONFIG.get('pages_index', 'json') as any[] | null;
    if (pagesIndex) {
      const targetPage = pagesIndex.find((p: any) => p.id === id);
      if (targetPage) {
        pageData = targetPage;
      }
    }
  }
  
  // 兼容逻辑：如果仍没有找到，退回到从旧版 pages 数组中查找
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
  await markChangesPending(env);
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
  await markChangesPending(env);
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
