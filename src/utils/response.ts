// 响应工具函数
import { Env } from '../types';

// CORS 头部
export function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 递归转换对象中的媒体 URL
 * 将生产域名替换为当前环境对应的域名 (针对开发环境测试)
 */
export function transformMediaUrls<T>(data: T, request?: Request): T {
  if (!data || !request) return data;
  
  const prodAssetsUrl = 'https://assets.kelloggfashion.com';
  const url = new URL(request.url);
  const host = `${url.protocol}//${url.host}`;

  // 如果当前访问的是 localhost，且数据包含生产媒体地址，则重写为本地
  if (!(host.includes('localhost') || host.includes('127.0.0.1'))) {
    return data;
  }

  const transform = (val: any): any => {
    if (typeof val === 'string') {
      if (val.includes(prodAssetsUrl)) {
        return val.replaceAll(prodAssetsUrl, host);
      }
      return val;
    }
    if (Array.isArray(val)) return val.map(transform);
    if (val !== null && typeof val === 'object') {
      const res: any = {};
      for (const k in val) res[k] = transform(val[k]);
      return res;
    }
    return val;
  };

  return transform(data);
}

// JSON 成功响应
export function jsonResponse<T>(data: T, env: Env, status = 200, request?: Request): Response {
  const finalData = request ? transformMediaUrls(data, request) : data;
  return new Response(JSON.stringify(finalData), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...corsHeaders(env),
    },
  });
}

// 错误响应
export function errorResponse(
  message: string,
  env: Env,
  status = 400
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
    },
  });
}

// OPTIONS 预检响应
export function optionsResponse(env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(env),
  });
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  env: Env,
  request?: Request
): Response {
  const response: PaginatedResponse<T> = {
    data: request ? transformMediaUrls(data, request) : data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
  return jsonResponse(response, env);
}
