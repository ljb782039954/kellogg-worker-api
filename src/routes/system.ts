import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { updateMediaReferences } from '../utils/media';

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

/**
 * Synchronize media references from existing database and KV data
 * This traverses all products, categories, blogs, reviews, and KV pages
 * to reconstruct the media_references table from scratch.
 */
export async function syncMediaReferences(request: Request, env: Env): Promise<Response> {
  // Simple safety check: Verify Admin Token
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
    return errorResponse('Unauthorized: Please provide a valid ADMIN_TOKEN', env, 401);
  }

  try {
    console.log('[SyncMedia] Starting full synchronization of media references...');

    // 1. Clear existing references to avoid duplicates or stale data
    await env.DB.prepare('DELETE FROM media_references').run();
    console.log('[SyncMedia] Cleared existing media references table');

    let syncCount = 0;

    // 2. Sync Products
    const productsRes = await env.DB.prepare('SELECT * FROM products').all<any>();
    const products = productsRes.results || [];
    console.log(`[SyncMedia] Found ${products.length} products to sync`);

    for (const product of products) {
      const productId = product.id;
      // Fetch sub-items of the product to match full product JSON format
      const imagesRes = await env.DB.prepare('SELECT * FROM product_images WHERE product_id = ?').bind(productId).all<any>();
      const sizesRes = await env.DB.prepare('SELECT * FROM product_sizes WHERE product_id = ?').bind(productId).all<any>();
      const colorsRes = await env.DB.prepare('SELECT * FROM product_colors WHERE product_id = ?').bind(productId).all<any>();
      const videosRes = await env.DB.prepare('SELECT * FROM product_videos WHERE product_id = ?').bind(productId).all<any>();

      const fullProduct = {
        ...product,
        images: imagesRes.results || [],
        sizes: sizesRes.results || [],
        colors: colorsRes.results || [],
        videos: videosRes.results || []
      };

      await updateMediaReferences(
        env.DB,
        'product',
        productId.toString(),
        product.name_zh || product.name_en || 'Unnamed Product',
        fullProduct
      );
      syncCount++;
    }

    // 3. Sync Categories
    const categoriesRes = await env.DB.prepare('SELECT * FROM categories').all<any>();
    const categories = categoriesRes.results || [];
    console.log(`[SyncMedia] Found ${categories.length} categories to sync`);

    for (const category of categories) {
      await updateMediaReferences(
        env.DB,
        'category',
        category.id,
        category.name_zh || category.name_en || 'Unnamed Category',
        category
      );
      syncCount++;
    }

    // 4. Sync Blogs
    const blogsRes = await env.DB.prepare('SELECT * FROM blogs').all<any>();
    const blogs = blogsRes.results || [];
    console.log(`[SyncMedia] Found ${blogs.length} blog posts to sync`);

    for (const blog of blogs) {
      await updateMediaReferences(
        env.DB,
        'blog',
        blog.id.toString(),
        blog.title_zh || blog.title_en || 'Unnamed Blog',
        blog
      );
      syncCount++;
    }

    // 5. Sync Reviews
    const reviewsRes = await env.DB.prepare('SELECT * FROM customer_reviews').all<any>();
    const reviews = reviewsRes.results || [];
    console.log(`[SyncMedia] Found ${reviews.length} customer reviews to sync`);

    for (const review of reviews) {
      await updateMediaReferences(
        env.DB,
        'review',
        review.id.toString(),
        `${review.client_name || 'Anonymous'} Review`,
        review
      );
      syncCount++;
    }

    // 6. Sync KV Configurations
    const listed = await env.KELLOGG_FRONTEND_CONFIG.list();
    const keys = listed.keys.map(k => k.name);
    console.log(`[SyncMedia] Found ${keys.length} KV configuration keys to check`);

    for (const key of keys) {
      if (key.startsWith('page:')) {
        const pageVal = await env.KELLOGG_FRONTEND_CONFIG.get(key, 'json') as any;
        if (pageVal) {
          const titleObj = pageVal.title || {};
          const title = typeof titleObj === 'string' ? titleObj : (titleObj.zh || titleObj.en || 'Unnamed Page');
          await updateMediaReferences(env.DB, 'page', key, `Page: ${title}`, pageVal);
          syncCount++;
        }
      } else if (key === 'pages') {
        const pagesList = await env.KELLOGG_FRONTEND_CONFIG.get(key, 'json') as any[];
        if (pagesList && Array.isArray(pagesList)) {
          console.log(`[SyncMedia] Found legacy 'pages' big key containing ${pagesList.length} pages to check`);
          for (const pageVal of pagesList) {
            if (pageVal && pageVal.id) {
              const titleObj = pageVal.title || {};
              const title = typeof titleObj === 'string' ? titleObj : (titleObj.zh || titleObj.en || 'Unnamed Page');
              await updateMediaReferences(env.DB, 'page', `page:${pageVal.id}`, `Page: ${title} (Legacy)`, pageVal);
              syncCount++;
            }
          }
        }
      } else if (key === 'site_settings') {
        const val = await env.KELLOGG_FRONTEND_CONFIG.get(key, 'json');
        if (val) {
          await updateMediaReferences(env.DB, 'global', key, 'Global Company Info', val);
          syncCount++;
        }
      } else if (key === 'header_config') {
        const val = await env.KELLOGG_FRONTEND_CONFIG.get(key, 'json');
        if (val) {
          await updateMediaReferences(env.DB, 'global', key, 'Header Configuration', val);
          syncCount++;
        }
      } else if (key === 'footer_config') {
        const val = await env.KELLOGG_FRONTEND_CONFIG.get(key, 'json');
        if (val) {
          await updateMediaReferences(env.DB, 'global', key, 'Footer Configuration', val);
          syncCount++;
        }
      }
    }

    console.log(`[SyncMedia] Media reference sync complete. Synced ${syncCount} entities.`);
    return jsonResponse({
      success: true,
      message: `Media references synchronized successfully. Processed ${syncCount} items.`,
    }, env);

  } catch (error: any) {
    console.error('[SyncMedia] Error:', error);
    return errorResponse(`Media reference sync failed: ${error.message}`, env, 500);
  }
}
