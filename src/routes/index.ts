// Kellogg API - Cloudflare Worker 入口

import { Env } from '../types';

// 商品路由
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from './products';

// 分类路由
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categories';

// 上传路由
import {
  uploadImage,
  uploadImages,
  deleteImage,
  listImages,
  serveMedia,
  serveOptimizedMedia,
} from './upload';

// 配置路由 (管理所有积木页面, footer, settings 等 KV 数据)
import {
  getConfig,
  setConfig,
  deleteConfig,
  listConfigKeys,
  batchGetConfig,
  getSiteSettings,
  updateSiteSettings,
  getPages,
  getPageById,
  updatePages,
} from './config';
import {
  submitInquiry,
  getInquiries,
  updateInquiryStatus,
  deleteInquiry,
} from './inquiries';
import {
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
} from './blogs';
import {
  getBlogCategories,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
} from './blogCategories';
import {
  getReviews,
  getAdminReviews,
  createReview,
  updateReview,
  deleteReview,
} from './reviews';
import { runGarbageCollection } from '../tasks/gc';
import { initKV, triggerBuild, syncMediaReferences } from './system';
import { fetchExchangeRates } from '../tasks/exchangeRates';

// 路由匹配器
type RouteHandler = (request: Request, env: Env, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
}

// 定义所有路由
export const routes: Route[] = [
  // ============================================
  // 公开 API (GET)
  // ============================================
  // 静态媒体资源代理 (图片/视频/资源)
  { method: 'GET', pattern: /^\/uploads\/(.+)$/, handler: (req, env, p) => serveMedia(req, env, p.id || '') },
  { method: 'GET', pattern: /^\/api\/image\/(.+)$/, handler: (req, env, p) => serveOptimizedMedia(req, env, p.id || '') },
  { method: 'GET', pattern: /^\/api\/media\/optimized\/(.+)$/, handler: (req, env, p) => serveOptimizedMedia(req, env, p.id || '') },
  { method: 'GET', pattern: /^\/api\/media\/(.+)$/, handler: (req, env, p) => serveMedia(req, env, p.id || '') },

  // 产品
  { method: 'GET', pattern: /^\/api\/products$/, handler: (req, env) => getProducts(req, env) },
  { method: 'GET', pattern: /^\/api\/products\/(\d+)$/, handler: (req, env, p) => getProduct(req, env, p.id) },

  // 分类
  { method: 'GET', pattern: /^\/api\/categories$/, handler: (req, env) => getCategories(req, env) },
  { method: 'GET', pattern: /^\/api\/categories\/([^/]+)$/, handler: (req, env, p) => getCategory(req, env, p.id) },

  // 站点与页面配置 (积木系统核心)
  { method: 'GET', pattern: /^\/api\/config\/site_settings$/, handler: (req, env) => getSiteSettings(req, env) },
  { method: 'GET', pattern: /^\/api\/config\/site-settings$/, handler: (req, env) => getSiteSettings(req, env) }, // 兼容旧版
  { method: 'GET', pattern: /^\/api\/config\/pages$/, handler: (req, env) => getPages(req, env) },
  { method: 'GET', pattern: /^\/api\/config\/pages\/([^/]+)$/, handler: (req, env, p) => getPageById(req, env, p.id) },
  { method: 'GET', pattern: /^\/api\/pages$/, handler: (req, env) => getPages(req, env) }, // 别名
  { method: 'GET', pattern: /^\/api\/pages\/([^/]+)$/, handler: (req, env, p) => getPageById(req, env, p.id) }, // 别名

  // 询盘提交
  { method: 'POST', pattern: /^\/api\/inquiries\/submit$/, handler: (req, env) => submitInquiry(req, env) },
  { method: 'POST', pattern: /^\/api\/inquiries$/, handler: (req, env) => submitInquiry(req, env) }, // 兼容别名

  // 博客文章 (公开)
  { method: 'GET', pattern: /^\/api\/blogs$/, handler: (req, env) => getBlogs(req, env) },
  { method: 'GET', pattern: /^\/api\/blogs\/([^/]+)$/, handler: (req, env, p) => getBlog(req, env, p.id) },

  // 博客分类 (公开)
  { method: 'GET', pattern: /^\/api\/blog-categories$/, handler: (req, env) => getBlogCategories(req, env) },

  // 客户评价 (公开)
  { method: 'GET', pattern: /^\/api\/reviews$/, handler: (req, env) => getReviews(req, env) },

  // ============================================
  // 管理 API (需要认证，POST/PUT/DELETE)
  // ============================================

  // 商品管理
  { method: 'POST', pattern: /^\/api\/products$/, handler: (req, env) => createProduct(req, env) },
  { method: 'PUT', pattern: /^\/api\/products\/(\d+)$/, handler: (req, env, p) => updateProduct(req, env, p.id) },
  { method: 'DELETE', pattern: /^\/api\/products\/(\d+)$/, handler: (req, env, p) => deleteProduct(req, env, p.id) },

  // 分类管理
  { method: 'POST', pattern: /^\/api\/categories$/, handler: (req, env) => createCategory(req, env) },
  { method: 'PUT', pattern: /^\/api\/categories\/([^/]+)$/, handler: (req, env, p) => updateCategory(req, env, p.id) },
  { method: 'DELETE', pattern: /^\/api\/categories\/([^/]+)$/, handler: (req, env, p) => deleteCategory(req, env, p.id) },

  // 询盘管理
  { method: 'GET', pattern: /^\/api\/inquiries$/, handler: (req, env) => getInquiries(req, env) },
  { method: 'PATCH', pattern: /^\/api\/inquiries\/(\d+)$/, handler: (req, env, p) => updateInquiryStatus(req, env, p.id) },
  { method: 'DELETE', pattern: /^\/api\/inquiries\/(\d+)$/, handler: (req, env, p) => deleteInquiry(req, env, p.id) },

  // 博客管理
  { method: 'POST', pattern: /^\/api\/blogs$/, handler: (req, env) => createBlog(req, env) },
  { method: 'PUT', pattern: /^\/api\/blogs\/(\d+)$/, handler: (req, env, p) => updateBlog(req, env, p.id) },
  { method: 'DELETE', pattern: /^\/api\/blogs\/(\d+)$/, handler: (req, env, p) => deleteBlog(req, env, p.id) },

  // 博客分类管理
  { method: 'POST', pattern: /^\/api\/blog-categories$/, handler: (req, env) => createBlogCategory(req, env) },
  { method: 'PUT', pattern: /^\/api\/blog-categories\/(\d+)$/, handler: (req, env, p) => updateBlogCategory(req, env, p.id) },
  { method: 'DELETE', pattern: /^\/api\/blog-categories\/(\d+)$/, handler: (req, env, p) => deleteBlogCategory(req, env, p.id) },

  // 客户评价管理
  { method: 'GET', pattern: /^\/api\/admin\/reviews$/, handler: (req, env) => getAdminReviews(req, env) },
  { method: 'POST', pattern: /^\/api\/admin\/reviews$/, handler: (req, env) => createReview(req, env) },
  { method: 'PUT', pattern: /^\/api\/admin\/reviews\/(\d+)$/, handler: (req, env, p) => updateReview(req, env, p.id) },
  { method: 'DELETE', pattern: /^\/api\/admin\/reviews\/(\d+)$/, handler: (req, env, p) => deleteReview(req, env, p.id) },

  // 文件上传
  { method: 'POST', pattern: /^\/api\/upload$/, handler: (req, env) => uploadImage(req, env) },
  { method: 'POST', pattern: /^\/api\/upload\/batch$/, handler: (req, env) => uploadImages(req, env) },
  { method: 'DELETE', pattern: /^\/api\/upload$/, handler: (req, env) => deleteImage(req, env) },
  { method: 'GET', pattern: /^\/api\/upload\/list$/, handler: (req, env) => listImages(req, env) },

  // 通用配置 KV 管理接口 (如保存 blocks / headers)
  { method: 'GET', pattern: /^\/api\/config\/keys$/, handler: (req, env) => listConfigKeys(req, env) },
  { method: 'GET', pattern: /^\/api\/config\/([^/]+)$/, handler: (req, env, p) => getConfig(req, env, p.id) },
  { method: 'POST', pattern: /^\/api\/config\/batch$/, handler: (req, env) => batchGetConfig(req, env) },
  { method: 'POST', pattern: /^\/api\/config$/, handler: (req, env) => setConfig(req, env) },
  { method: 'PUT', pattern: /^\/api\/config\/pages$/, handler: (req, env) => updatePages(req, env) },
  { method: 'PUT', pattern: /^\/api\/config\/site_settings$/, handler: (req, env) => updateSiteSettings(req, env) },
  { method: 'DELETE', pattern: /^\/api\/config\/([^/]+)$/, handler: (req, env, p) => deleteConfig(req, env, p.id) },
  
  // GC 手动触发 (测试用/后台按钮用)
  { method: 'POST', pattern: /^\/api\/system\/gc$/, handler: async (req, env) => {
      // 需要管理员权限
      const authError = req.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}` ? null : new Response('Unauthorized', { status: 401 });
      if (authError) return authError;
      
      // 不等待其执行完，直接返回成功以防超时 (waitUntil 可放入ctx但我们这里简单后台触发也可以直接await，因为本地模拟通常不超时)
      await runGarbageCollection(env);
      return new Response(JSON.stringify({ message: 'Garbage Collection started/completed' }), { headers: { 'Content-Type': 'application/json' } });
  } },

  // 手动触发汇率更新 API (测试用/后台按钮用)
  { method: 'POST', pattern: /^\/api\/system\/update-rates$/, handler: async (req, env) => {
      // 如果配置了 ADMIN_TOKEN，进行简单校验。如果未配置则允许开发时使用。
      if (env.ADMIN_TOKEN) {
        const authError = req.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}` ? null : new Response('Unauthorized', { status: 401 });
        if (authError) return authError;
      }
      
      await fetchExchangeRates(env);
      return new Response(JSON.stringify({ message: 'Exchange rates updated' }), { headers: { 'Content-Type': 'application/json' } });
  } },

  // 主动触发构建 API
  { method: 'POST', pattern: /^\/api\/system\/trigger-build$/, handler: (req, env) => triggerBuild(req, env) },

  // 数据初始化 API
  { method: 'POST', pattern: /^\/api\/system\/init-kv$/, handler: (req, env) => initKV(req, env) },

  // 媒体引用关系同步 API
  { method: 'POST', pattern: /^\/api\/system\/sync-media-references$/, handler: (req, env) => syncMediaReferences(req, env) },
];
