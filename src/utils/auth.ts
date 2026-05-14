// 认证工具函数
import { Env } from '../types';
import { errorResponse } from './response';

// 验证 Admin Token
export function verifyAdminToken(
  request: Request,
  env: Env
): Response | null {
  // 如果没有配置 ADMIN_TOKEN，跳过验证（仅限开发环境）
  if (!env.ADMIN_TOKEN) {
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('未提供认证令牌', env, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== env.ADMIN_TOKEN) {
    return errorResponse('认证令牌无效', env, 401);
  }

  return null; // 验证通过
}

// 需要认证的中间件包装器
export function requireAuth(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
) {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    const authError = verifyAdminToken(request, env);
    if (authError) {
      return authError;
    }
    return handler(request, env, ctx);
  };
}
