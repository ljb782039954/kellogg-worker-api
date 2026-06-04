import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BINDING = 'KELLOGG_FRONTEND_CONFIG';
const DATA_DIR = path.resolve(__dirname, '../src/kvData');
const PAGES_DIR = path.resolve(DATA_DIR, 'pages');

// 确保目录存在
if (!fs.existsSync(PAGES_DIR)) {
  fs.mkdirSync(PAGES_DIR, { recursive: true });
}

// 映射 KV key 到本地文件名
function getLocalPath(key) {
  if (key === 'pages_index') {
    return path.join(PAGES_DIR, 'pages_index.json');
  }
  if (key.startsWith('page:')) {
    const pageId = key.substring(5); // page:about -> about
    return path.join(PAGES_DIR, `page_${pageId}.json`);
  }
  if (key === 'exchangeRates') {
    return path.join(DATA_DIR, 'exchangeRates.json');
  }
  if (key === 'footer_config') {
    return path.join(DATA_DIR, 'footer_config.json');
  }
  if (key === 'header_config') {
    return path.join(DATA_DIR, 'header_config.json');
  }
  // if (key === 'inquiry_config') {
  //   return path.join(DATA_DIR, 'inquiryConfig.json');
  // }
  if (key === 'site_settings') {
    return path.join(DATA_DIR, 'siteSetting.json');
  }
  return null;
}

async function run() {
  console.log('🔄 开始从远程拉取最新的 KV 数据...');

  // 1. 获取远程的 key 列表
  let keysList;
  try {
    const output = execSync(`npx wrangler kv key list --binding=${BINDING}`, { encoding: 'utf8' });
    keysList = JSON.parse(output);
    console.log(`✅ 成功获取远程 key 列表，共 ${keysList.length} 个 key。`);
  } catch (error) {
    console.error('❌ 获取远程 key 列表失败:', error.message);
    process.exit(1);
  }

  // 2. 依次拉取每个 key 的值并保存到本地文件 & 本地 KV
  for (const { name: key } of keysList) {
    if (key === 'build_status') {
      console.log(`⏩ 忽略 build_status 键`);
      continue;
    }

    console.log(`📥 正在拉取 KV 键: "${key}"...`);
    let value;
    try {
      value = execSync(`npx wrangler kv key get "${key}" --binding=${BINDING}`, { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error(`❌ 拉取键 "${key}" 失败:`, error.message);
      continue;
    }

    // 尝试解析为 JSON 并格式化
    let formattedValue = value;
    try {
      const parsed = JSON.parse(value);
      formattedValue = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // 保持原样
    }

    // 保存到本地 JSON 文件
    const localPath = getLocalPath(key);
    if (localPath) {
      fs.writeFileSync(localPath, formattedValue, 'utf8');
      console.log(`   💾 已写入本地文件: ${path.relative(process.cwd(), localPath)}`);
    } else {
      console.log(`   ⚠️ 未知 key 类型，未写入本地文件: "${key}"`);
    }

    // 同步到本地 KV (--local)
    try {
      // 在本地 KV 中，我们需要把这个值存进去。可以使用 wrangler kv key put
      // 临时将值写入一个临时文件，然后通过 --path 参数放入，避免命令行字符过长报错或转义问题
      const tempFile = path.join(__dirname, `temp_${key.replace(/:/g, '_')}.json`);
      fs.writeFileSync(tempFile, formattedValue, 'utf8');
      execSync(`npx wrangler kv key put "${key}" --binding=${BINDING} --path="${tempFile}" --local`);
      fs.unlinkSync(tempFile);
      console.log(`   ⚙️ 已同步到本地 KV (--local)`);
    } catch (error) {
      console.error(`   ❌ 同步到本地 KV 失败:`, error.message);
    }
  }

  console.log('🎉 远程 KV 数据拉取及本地同步完成！');
}

run();
