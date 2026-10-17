import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../web/.env.local', import.meta.url));
let text = '';
try { text = readFileSync(envPath, 'utf8'); } catch { /* injected configuration may be sufficient */ }
const get = (name) => process.env[name] || text.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
const local = get('D1_LOCAL_API_URL');
const url = local || get('D1_GATEWAY_URL');
const token = get(local ? 'D1_LOCAL_API_TOKEN' : 'D1_GATEWAY_TOKEN');
if (!url || !token) throw new Error('Chưa có cấu hình gateway. Chạy npm run setup:local hoặc cấu hình gateway remote.');
const target = new URL(url);
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
if (target.username || target.password || target.search || target.hash || target.pathname !== '/query' ||
  (local ? target.protocol !== 'http:' || !loopback : target.protocol !== 'https:' || loopback) ||
  token.length < 32) throw new Error('Cấu hình gateway chưa hợp lệ; không gửi request.');
const database = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ sql: 'SELECT id FROM schools WHERE id = ?', params: ['school-ben-tre'] }),
  redirect: 'error',
  signal: AbortSignal.timeout(10000),
});
if (!database.ok) throw new Error('Gateway chưa trả lời thành công. Kiểm tra cấu hình và tiến trình D1.');
const result = await database.json();
if (!result.success || result.result?.[0]?.results?.[0]?.id !== 'school-ben-tre') {
  throw new Error('D1 chưa có seed trường; kiểm tra migration.');
}
const frontend = await fetch(process.env.LHH_DEV_APP_URL || 'http://127.0.0.1:3000', {
  redirect: 'error', signal: AbortSignal.timeout(10000),
});
const homepage = await frontend.text();
if (!frontend.ok || !homepage.includes('class="home-shortcuts-grid"') ||
    !homepage.includes('href="/tro-choi/ca-dao-tuc-ngu"')) {
  throw new Error('Ứng dụng chưa trả về trang chủ hợp lệ.');
}
console.log('D1 truy vấn được seed trường và Next.js trả về trang chủ: đạt.');
