import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';

// Import data from jsonData standard
import pagesIndex from '../kvData/pages/pages_index.json';
import pageHome from '../kvData/pages/page_home.json';
import pageAbout from '../kvData/pages/page_about.json';
import pageFaq from '../kvData/pages/page_faq.json';
import pageProducts from '../kvData/pages/page_products.json';
import pageSystemInquiry from '../kvData/pages/page_system-inquiry.json';
import pageSystemBlog from '../kvData/pages/page_system-blog.json';
import pageCustomerReviews from '../kvData/pages/page_customer-reviews.json';
import siteSetting from '../kvData/siteSetting.json';
import header from '../kvData/header_config.json';
import footer from '../kvData/footer_config.json';

/**
 * Initialize KV Data
 * Write preset data from src/jsonData into KV storage
 */
export async function initKV(request: Request, env: Env): Promise<Response> {
  // Simple safety check: Verify Admin Token
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
    return errorResponse('Unauthorized: Please provide a valid ADMIN_TOKEN', env, 401);
  }

  try {
    console.log('[Init] Starting KV initialization from jsonData...');

    // 1. Initialize pages_index and core page configs
    await env.KELLOGG_FRONTEND_CONFIG.put('pages_index', JSON.stringify(pagesIndex));
    console.log('[Init] pages_index initialized');

    await env.KELLOGG_FRONTEND_CONFIG.put('page:home', JSON.stringify(pageHome));
    console.log('[Init] page:home initialized');

    await env.KELLOGG_FRONTEND_CONFIG.put('page:about', JSON.stringify(pageAbout));
    console.log('[Init] page:about initialized');

    await env.KELLOGG_FRONTEND_CONFIG.put('page:faq', JSON.stringify(pageFaq));
    console.log('[Init] page:faq initialized');

    await env.KELLOGG_FRONTEND_CONFIG.put('page:products', JSON.stringify(pageProducts));
    console.log('[Init] page:products initialized');

    await env.KELLOGG_FRONTEND_CONFIG.put('page:system-inquiry', JSON.stringify(pageSystemInquiry));
    console.log('[Init] page:system-inquiry initialized');

    await env.KELLOGG_FRONTEND_CONFIG.put('page:system-blog', JSON.stringify(pageSystemBlog));
    console.log('[Init] page:system-blog initialized');

    await env.KELLOGG_FRONTEND_CONFIG.put('page:customer-reviews', JSON.stringify(pageCustomerReviews));
    console.log('[Init] page:customer-reviews initialized');

    // 2. Initialize site settings
    await env.KELLOGG_FRONTEND_CONFIG.put('site_settings', JSON.stringify(siteSetting));
    console.log('[Init] Site settings initialized');

    // 3. Initialize navigation menu (Header)
    await env.KELLOGG_FRONTEND_CONFIG.put('header_config', JSON.stringify(header));
    console.log('[Init] Header initialized');

    // 4. Initialize footer
    await env.KELLOGG_FRONTEND_CONFIG.put('footer_config', JSON.stringify(footer));
    console.log('[Init] Footer initialized');

    return jsonResponse({
      success: true,
      message: 'KV data initialized successfully from jsonData shards',
      initializedKeys: [
        'pages_index',
        'page:home',
        'page:about',
        'page:faq',
        'page:products',
        'page:system-inquiry',
        'page:system-blog',
        'page:customer-reviews',
        'site_settings',
        'header_config',
        'footer_config'
      ]
    }, env);

  } catch (error: any) {
    console.error('[Init] Error:', error);
    return errorResponse(`Initialization failed: ${error.message}`, env, 500);
  }
}

/**
 * Mark that there are pending changes in KV
 */
export async function markChangesPending(env: Env): Promise<void> {
  try {
    const statusStr = await env.KELLOGG_FRONTEND_CONFIG.get('build_status');
    let status = { hasChanges: true, lastBuildTime: '' };
    
    if (statusStr) {
      try {
        const parsed = JSON.parse(statusStr);
        status = {
          ...parsed,
          hasChanges: true
        };
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    await env.KELLOGG_FRONTEND_CONFIG.put('build_status', JSON.stringify(status));
    console.log('[ChangeTracker] Marked hasChanges as true');
  } catch (error) {
    console.error('[ChangeTracker] Failed to mark changes pending:', error);
  }
}

/**
 * Trigger Cloudflare build deployment
 */
export async function triggerBuild(request: Request, env: Env): Promise<Response> {
  // Simple safety check: Verify Admin Token
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
    return errorResponse('Unauthorized: Please provide a valid ADMIN_TOKEN', env, 401);
  }

  const deployHookUrl = env.DEPLOY_HOOK_URL;
  if (!deployHookUrl) {
    return errorResponse('Deploy hook URL (DEPLOY_HOOK_URL) is not configured in Worker environment variables.', env, 500);
  }

  try {
    console.log('[Deploy] Triggering deploy hook:', deployHookUrl);
    
    // Call Cloudflare Pages deploy hook
    const response = await fetch(deployHookUrl, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return errorResponse(`Failed to trigger deploy hook: ${response.statusText} - ${errorText}`, env, response.status);
    }

    // Update build status in KV
    const statusStr = await env.KELLOGG_FRONTEND_CONFIG.get('build_status');
    let status = { hasChanges: false, lastBuildTime: new Date().toISOString() };
    
    if (statusStr) {
      try {
        const parsed = JSON.parse(statusStr);
        status = {
          ...parsed,
          hasChanges: false,
          lastBuildTime: new Date().toISOString()
        };
      } catch (e) {
        // Ignore
      }
    }
    
    await env.KELLOGG_FRONTEND_CONFIG.put('build_status', JSON.stringify(status));
    console.log('[Deploy] Deploy triggered successfully, marked hasChanges as false');

    return jsonResponse({
      success: true,
      message: 'Build triggered successfully',
      buildStatus: status
    }, env);

  } catch (error: any) {
    console.error('[Deploy] Error:', error);
    return errorResponse(`Failed to trigger build: ${error.message}`, env, 500);
  }
}
