import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const configDirectory = process.env.XDG_CONFIG_HOME || join(tmpdir(), 'lhh-config');
mkdirSync(configDirectory, { recursive: true });
const child = spawn(process.execPath, [`${root}web/node_modules/wrangler/bin/wrangler.js`, ...process.argv.slice(2)], {
  cwd: `${root}web`,
  stdio: 'inherit',
  env: {
    ...process.env,
    XDG_CONFIG_HOME: configDirectory,
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || join(tmpdir(), 'lhh-wrangler.log'),
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('Không thể khởi động Wrangler. Chạy npm ci trong web/ trước.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
