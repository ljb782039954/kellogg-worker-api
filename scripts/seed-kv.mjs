/**
 * Seed KV data via API call
 * Usage: node scripts/seed-kv.mjs [url] [token]
 */

const targetUrl = process.argv[2] || 'http://localhost:8787';
const token = process.argv[3] || 'dev-admin-token';

console.log(`[Seed] Target: ${targetUrl}`);
console.log(`[Seed] Authorization: Bearer ${token.substring(0, 4)}***`);

const initEndpoint = `${targetUrl.replace(/\/$/, '')}/api/system/init-kv`;

async function seed() {
  try {
    const response = await fetch(initEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Success:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Failed:', JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Connection Error:', error.message);
    console.log('\nTip: Make sure the worker is running (npm run dev) if seeding locally.');
    process.exit(1);
  }
}

seed();
