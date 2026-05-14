import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';

// Import data from jsonData standard
import pages from '../jsonData/pages.json';
import siteSetting from '../jsonData/siteSetting.json';
import header from '../jsonData/header_config.json';
import footer from '../jsonData/footer_config.json';
import inquiryConfig from '../jsonData/inquiryConfig.json';

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

    // 1. Initialize page configuration
    await env.KELLOGG_FRONTEND_CONFIG.put('pages', JSON.stringify(pages));
    console.log('[Init] Pages initialized');

    // 2. Initialize site settings
    await env.KELLOGG_FRONTEND_CONFIG.put('site_settings', JSON.stringify(siteSetting));
    console.log('[Init] Site settings initialized');

    // 3. Initialize navigation menu (Header)
    await env.KELLOGG_FRONTEND_CONFIG.put('header_config', JSON.stringify(header));
    console.log('[Init] Header initialized');

    // 4. Initialize footer
    await env.KELLOGG_FRONTEND_CONFIG.put('footer_config', JSON.stringify(footer));
    console.log('[Init] Footer initialized');

    // 5. Initialize Inquiry Config
    await env.KELLOGG_FRONTEND_CONFIG.put('inquiry_config', JSON.stringify(inquiryConfig));
    console.log('[Init] Inquiry config initialized');

    return jsonResponse({
      success: true,
      message: 'KV data initialized successfully from jsonData',
      initializedKeys: ['pages', 'site_settings', 'header_config', 'footer_config', 'inquiry_config']
    }, env);

  } catch (error: any) {
    console.error('[Init] Error:', error);
    return errorResponse(`Initialization failed: ${error.message}`, env, 500);
  }
}
