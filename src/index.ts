// Kellogg API - Cloudflare Worker 入口

import { Env } from './types';
import { 
  optionsResponse, 
  errorResponse, 
  // jsonResponse 
} from './utils/response';

import { fetchExchangeRates } from './tasks/exchangeRates';
// import { runGarbageCollection } from './tasks/gc';
import { routes } from './routes';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return optionsResponse(env);
    }

    try {
      // 路由匹配
      for (const route of routes) {
        if (route.method === request.method || route.method === 'ANY') {
          const match = url.pathname.match(route.pattern);
          if (match) {
            // 提取捕获组作为参数，如果有的话 (例如 id)
            const params: Record<string, string> = {};
            if (match.length > 1) {
              params.id = match[1];
            }
            return await route.handler(request, env, params);
          }
        }
      }

      // 匹配失败返回 404
      return errorResponse(`路由未找到: ${request.method} ${url.pathname}`, env, 404);
    } catch (err) {
      console.error(err);
      return errorResponse('内部服务器错误', env, 500);
    }
  },

  // 定时任务入口 (Cron Triggers)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log(`[Cron] Scheduled execution triggering: ${event.cron}`);
    
    // 如果是每日汇率同步任务
    if (event.cron === '* * * * *' || event.cron === '0 0 * * *' || event.cron.includes('0 0')) {
        ctx.waitUntil(fetchExchangeRates(env));
    }
    
    // Weekly GC task for orphaned R2 assets (DISABLED)
    if (event.cron === '0 3 * * SUN' || event.cron.includes('SUN')) {
        console.log('[Cron] Weekly GC task is currently disabled.');
        // ctx.waitUntil(runGarbageCollection(env));
    }
  }
};
