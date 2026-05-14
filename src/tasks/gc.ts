import { Env } from '../types';

export async function runGarbageCollection(env: Env): Promise<void> {
  console.log('[GC] Starting Garbage Collection for R2 Assets...');
  
  try {
    // 1. 获取所有的 D1 引用
    const productsRes = await env.DB.prepare('SELECT image FROM products WHERE image IS NOT NULL').all<{image: string}>();
    const categoriesRes = await env.DB.prepare('SELECT image FROM categories WHERE image IS NOT NULL').all<{image: string}>();
    const productImagesRes = await env.DB.prepare('SELECT image_key FROM product_images').all<{image_key: string}>();
    
    // 把所有的 D1 图片字段转成单一的大字符串方便 includes 匹配
    const d1Strings = [
      ...productsRes.results.map(r => r.image),
      ...categoriesRes.results.map(r => r.image),
      ...productImagesRes.results.map(r => r.image_key)
    ].join('|||');

    // 2. 获取所有的 KV 引用 (序列化为纯文本进行包含匹配，这样哪怕深层嵌套也能搜到)
    const keysToFetch = ['pages', 'pages_index', 'site_settings', 'header_config', 'footer_config'];
    let kvStrings = '';
    for (const k of keysToFetch) {
      const val = await env.KELLOGG_FRONTEND_CONFIG.get(k);
      if (val) kvStrings += val + '|||';
    }

    // Fetch all dynamically created page details (prefix: 'page:')
    let kvCursor: string | undefined = undefined;
    let listComplete = false;
    do {
      const listedKeys: any = await env.KELLOGG_FRONTEND_CONFIG.list({ prefix: 'page:', cursor: kvCursor });
      for (const key of listedKeys.keys) {
        const val = await env.KELLOGG_FRONTEND_CONFIG.get(key.name);
        if (val) kvStrings += val + '|||';
      }
      listComplete = listedKeys.list_complete;
      kvCursor = listedKeys.cursor;
    } while (!listComplete);

    const allReferencesText = d1Strings + '|||' + kvStrings;

    // 3. 列出 R2 中的所有对象
    let truncated = false;
    let cursor: string | undefined = undefined;
    let deletedCount = 0;
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoMs = oneDayAgo.getTime();

    do {
      const listParams: R2ListOptions = { limit: 50 };
      if (cursor) listParams.cursor = cursor;
      
      const listed = await env.ASSETS.list(listParams);
      
      for (const obj of listed.objects) {
        if (!obj.key.startsWith('uploads/')) continue; // 仅清理 uploads/ 目录

        // 保护期：上传时间不足 24 小时的图片一律不予清理，以防用户正在上传但尚未保存表单
        const uploadedTime = new Date(obj.uploaded).getTime();
        if (uploadedTime > oneDayAgoMs) {
          continue;
        }

        // 提取原始文件名并在全站依赖文本中查找
        // 匹配逻辑：URL中可能全量保存 (`uploads/...`) 或纯文件名，或者被encode转义
        const filename = obj.key.replace('uploads/', '');
        const encodedFilename = encodeURIComponent(filename);

        const isReferenced = 
          allReferencesText.includes(obj.key) || 
          allReferencesText.includes(filename) || 
          allReferencesText.includes(encodedFilename);

        if (!isReferenced) {
          console.log(`[GC] Deleting orphaned file: ${obj.key}`);
          await env.ASSETS.delete(obj.key);
          deletedCount++;
        }
      }

      truncated = listed.truncated;
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (truncated);

    console.log(`[GC] Garbage Collection completed. Deleted ${deletedCount} orphaned files.`);
  } catch (err) {
    console.error('[GC] Error running Garbage Collection:', err);
  }
}
