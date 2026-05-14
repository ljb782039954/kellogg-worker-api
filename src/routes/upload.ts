import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyAdminToken } from '../utils/auth';

// 生成指定长度的随机字符串
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function uploadImage(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get('file') as unknown as File;
  const width = formData.get('width') as string || '';
  const height = formData.get('height') as string || '';

  if (!file) {
    return errorResponse('未提供文件', env, 400);
  }

  // 1. 生成新文件名: 原始文件名 + 16位随机字符串 + 后缀
  const originalName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9_-]/g, '_');
  const extension = file.name.substring(file.name.lastIndexOf('.'));
  const randomSuffix = generateRandomString(16);
  const newFilename = `${originalName}_${randomSuffix}${extension}`;
  const key = `uploads/${newFilename}`;
  const thumbKey = `thumbnails/${newFilename}`;

  const arrayBuffer = await file.arrayBuffer();

  // 2. 保存原图
  await env.ASSETS.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name,
      width,
      height,
      uploadedAt: new Date().toISOString()
    }
  });

  // 3. 生成并保存缩略图 (150px 宽，等比缩放)
  // 利用 Cloudflare Image Resizing 接口
  try {
    const thumbResizingUrl = `${env.ASSETS_BASE_URL}/cdn-cgi/image/width=150,quality=75,format=auto/uploads/${newFilename}`;
    const thumbResponse = await fetch(thumbResizingUrl);
    
    if (thumbResponse.ok) {
      const thumbBuffer = await thumbResponse.arrayBuffer();
      await env.ASSETS.put(thumbKey, thumbBuffer, {
        httpMetadata: { contentType: thumbResponse.headers.get('Content-Type') || file.type }
      });
      console.log(`Thumbnail created for: ${newFilename}`);
    } else {
      console.warn(`Thumbnail generation failed (status: ${thumbResponse.status}) for ${newFilename}`);
    }
  } catch (err) {
    console.error(`Failed to generate thumbnail for ${newFilename}:`, err);
  }

  return jsonResponse({
    url: `${env.ASSETS_BASE_URL}/${key}`,
    thumbUrl: `${env.ASSETS_BASE_URL}/${thumbKey}`,
    key,
    name: newFilename,
    dimensions: width && height ? `${width}x${height}` : undefined
  }, env);
}

export async function uploadImages(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const formData = await request.formData();
  const files = formData.getAll('files') as unknown as File[];

  const results = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const shortHash = hashHex.substring(0, 8);

    const key = `uploads/${shortHash}-${file.name}`;
    await env.ASSETS.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });
    results.push({
      url: `${env.ASSETS_BASE_URL}/${key}`,
      key
    });
  }

  return jsonResponse(results, env);
}

export async function deleteImage(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) return errorResponse('缺少 key', env, 400);

  await env.ASSETS.delete(key);
  return jsonResponse({ message: '删除成功' }, env);
}

export async function listImages(request: Request, env: Env): Promise<Response> {
  const authError = verifyAdminToken(request, env);
  if (authError) return authError;

  // 列出 uploads 目录下的图片
  const listed = await env.ASSETS.list({
    prefix: 'uploads/',
    include: ['customMetadata']
  } as any);

  const results = listed.objects.map(obj => {
    const filename = obj.key.replace('uploads/', '');
    const meta = obj.customMetadata || {};
    
    return {
      key: obj.key,
      name: filename,
      url: `${env.ASSETS_BASE_URL}/${obj.key}`,
      // 缩略图路径: thumbnails/文件名 (如果不存在则回退原图)
      thumbUrl: `${env.ASSETS_BASE_URL}/thumbnails/${filename}`,
      size: obj.size,
      dimensions: meta.width && meta.height ? `${meta.width}x${meta.height}` : undefined,
      uploaded: obj.uploaded
    };
  });

  // 按上传时间倒序排列 (最新的在前)
  results.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

  return jsonResponse(results, env);
}

export async function serveMedia(request: Request, env: Env, filename: string): Promise<Response> {
  const decodedFilename = decodeURIComponent(filename);
  const key = `uploads/${decodedFilename}`;

  // 处理 Range 请求 (对于视频流非常重要)
  const rangeHeader = request.headers.get('Range');
  
  try {
    let object;
    if (rangeHeader) {
      object = await env.ASSETS.get(key, {
        range: request.headers,
        onlyIf: request.headers,
      });
    } else {
      object = await env.ASSETS.get(key, {
        onlyIf: request.headers,
      });
    }

    if (!object || !('body' in object)) {
      return errorResponse(`资源不存在: ${decodedFilename}`, env, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers as any);
    headers.set('etag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000');

    // 206 Partial Content for Range requests, 200 for full content
    const status = rangeHeader ? 206 : 200;

    return new Response(object.body, {
      headers,
      status,
    });
  } catch (err) {
    console.error(`Serve Media Error:`, err);
    return errorResponse('无法获取媒体资源', env, 500);
  }
}

/**
 * 响应经过优化的媒体资源 (按照用户要求的 Transformations 逻辑)
 */
export async function serveOptimizedMedia(request: Request, env: Env, filename: string): Promise<Response> {
  const url = new URL(request.url);
  const w = parseInt(url.searchParams.get('w') || '0');
  
  // 1. 逻辑：如果没传 w，默认 768
  const targetWidth = w > 0 ? Math.min(Math.max(w, 16), 3840) : 768;
  
  // 2. 逻辑：自动质量控制 (针对服装类，移动端 75, 桌面端 85)
  const quality = targetWidth <= 768 ? 75 : 85;

  // 3. 构造源地址 (R2 自定义域名 + uploads 路径)
  const sourceUrl = `${env.ASSETS_BASE_URL}/uploads/${filename}`;

  // 核心逻辑：直接构造 Cloudflare 官方的 /cdn-cgi/image/ 路径
  // 这样可以确保即便 Worker 在 .workers.dev 下，也能通过重定向触发真正的图像处理
  const optimizedUrl = `${env.ASSETS_BASE_URL}/cdn-cgi/image/width=${targetWidth},quality=${quality},format=auto/uploads/${filename}`;

  try {
    // 4. 尝试直接 fetch 优化后的图片
    const response = await fetch(sourceUrl, {
      cf: {
        image: {
          width: targetWidth,
          quality: quality,
          fit: 'scale-down'
        }
      }
    });

    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      
      // 确保有图片类型的 Content-Type
      const contentType = response.headers.get('Content-Type');
      if (!contentType || contentType.includes('text') || contentType.includes('application')) {
          const ext = filename.split('.').pop()?.toLowerCase();
          const type = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
          headers.set('Content-Type', type);
      }
      
      return new Response(response.body, {
        status: response.status,
        headers
      });
    }

    // 5. 如果 fetch(cf) 失败 (例如在 .workers.dev 域名下)，则执行 302 重定向到优化地址
    // 这是最稳妥的方案，浏览器会自动处理跨域和优化
    console.warn(`Worker-side optimization not available, redirecting to: ${optimizedUrl}`);
    return Response.redirect(optimizedUrl, 302);

  } catch (err) {
    console.warn(`Optimization error, falling back to redirect:`, err);
    return Response.redirect(optimizedUrl, 302);
  }
}
