import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = `${root}web/.env.local`;
const varsPath = `${root}.dev.vars`;
mkdirSync(`${root}web`, { recursive: true });
let text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(`${root}.env.example`, 'utf8');
let vars = existsSync(varsPath) ? readFileSync(varsPath, 'utf8') : '';
function value(source, key) {
  const match = source.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') || '';
}
function add(source, key, next) {
  if (value(source, key)) return source;
  const line = `${key}=${next}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(source) ? source.replace(pattern, () => line) : `${source.replace(/\n?$/, '\n')}${line}\n`;
}
if (!process.env.NEXTAUTH_SECRET && !value(text, 'NEXTAUTH_SECRET')) {
  text = add(text, 'NEXTAUTH_SECRET', randomBytes(32).toString('base64url'));
}
const remote = process.env.D1_GATEWAY_URL || value(text, 'D1_GATEWAY_URL');
if (!remote) {
  const existingToken = value(text, 'D1_LOCAL_API_TOKEN');
  const workerToken = value(vars, 'D1_GATEWAY_TOKEN');
  if (existingToken && workerToken && existingToken !== workerToken) {
    throw new Error('Khóa gateway local không khớp. Kiểm tra hai file cấu hình trước khi tiếp tục.');
  }
  const token = existingToken || workerToken || randomBytes(32).toString('hex');
  text = add(text, 'D1_LOCAL_API_URL', 'http://127.0.0.1:8787/query');
  text = add(text, 'D1_LOCAL_API_TOKEN', token);
  vars = add(vars, 'D1_GATEWAY_TOKEN', token);
  writeFileSync(varsPath, vars, { mode: 0o600 });
}
writeFileSync(envPath, text, { mode: 0o600 });
console.log('Đã chuẩn bị cấu hình local. Các khóa đã có được giữ nguyên; chưa cấu hình Google OAuth.');
