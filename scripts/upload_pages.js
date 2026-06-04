const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KV_NAMESPACE = 'KELLOGG_FRONTEND_CONFIG';
const DIR = path.join(__dirname, '../src/kvData/pages');

console.log('Uploading pages to KV...');

const files = fs.readdirSync(DIR);

for (const file of files) {
  if (!file.endsWith('.json')) continue;
  
  const filePath = path.join(DIR, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Determine key name
  let keyName;
  if (file === 'pages_index.json') {
    keyName = 'pages_index';
  } else if (file.startsWith('page_')) {
    // filename is page_id.json
    const id = file.replace('page_', '').replace('.json', '');
    keyName = `page:${id}`;
  } else {
    continue;
  }
  
  const isLocal = process.argv.includes('--local');
  const localFlag = isLocal ? '--local' : '';
  console.log(`Uploading key: ${keyName} ${isLocal ? '(LOCAL)' : '(REMOTE)'} ...`);
  try {
    // using wrangler kv:key put
    execSync(`npx wrangler kv:key put --binding=${KV_NAMESPACE} "${keyName}" --path="${filePath}" ${localFlag}`, {
      stdio: 'inherit'
    });
    console.log(`✅ Successfully uploaded ${keyName}`);
  } catch (err) {
    console.error(`❌ Failed to upload ${keyName}:`, err.message);
  }
}

console.log('Upload complete.');
