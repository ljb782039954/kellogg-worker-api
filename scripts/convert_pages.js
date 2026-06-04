const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outputDir = path.join(__dirname, '../src/kvData/pages');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

try {
  console.log('Fetching latest pages data from KV...');
  // Use child_process to avoid PowerShell's UTF-16LE redirection issues
  const stdout = execSync('npx wrangler kv:key get pages --binding KELLOGG_FRONTEND_CONFIG', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  
  const startIdx = stdout.indexOf('[');
  const endIdx = stdout.lastIndexOf(']');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Failed to find JSON array in KV output.');
  }

  const jsonStr = stdout.slice(startIdx, endIdx + 1);
  const pages = JSON.parse(jsonStr);

  const pagesIndex = [];

  for (const page of pages) {
    // 构建详情页数据
    const detailData = {
      id: page.id,
      blocks: page.blocks || []
    };
    const detailPath = path.join(outputDir, `page_${page.id}.json`);
    fs.writeFileSync(detailPath, JSON.stringify(detailData, null, 2));

    // 构建索引页数据
    const indexEntry = {
      id: page.id,
      path: page.path,
      title: page.title,
      isFixed: page.isFixed,
      lastModified: page.lastModified || new Date().toISOString(),
      seo: page.seo || {
        title: { zh: `${page.title?.zh || ''} | KELLOGG`, en: `${page.title?.en || ''} | KELLOGG` },
        description: { zh: '', en: '' }
      }
    };
    pagesIndex.push(indexEntry);
  }

  // 写入索引文件
  const indexPath = path.join(outputDir, 'pages_index.json');
  fs.writeFileSync(indexPath, JSON.stringify(pagesIndex, null, 2));

  console.log('转换完成！');
  console.log(`生成了索引文件: pages_index.json (${pagesIndex.length} 个页面)`);
  console.log(`生成了详情文件: page_*.json (${pagesIndex.length} 个文件)`);

} catch (error) {
  console.error('转换失败:', error);
}
