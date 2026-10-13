// Cầu nối server-to-server. Production dùng binding D1; local chỉ bind loopback.
// Không đưa token hoặc endpoint có quyền truy vấn vào client Next.js.
const MAX_QUERIES = 50;
const MAX_BODY_BYTES = 1024 * 1024;

function error(status, message) {
  return Response.json(
    { success: false, errors: [{ message }], result: [] },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!env.D1_GATEWAY_TOKEN || env.D1_GATEWAY_TOKEN.length < 32) {
      return error(503, 'Database gateway is not configured');
    }
    if (request.headers.get('authorization') !== `Bearer ${env.D1_GATEWAY_TOKEN}`) {
      return error(401, 'Unauthorized');
    }
    if (path === '/health' && request.method === 'GET') {
      try {
        await env.DB.prepare('SELECT 1 AS healthy').first();
        return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
      } catch {
        return error(503, 'Database is unavailable');
      }
    }
    if (path !== '/query') return error(404, 'Not found');
    if (request.method !== 'POST') return error(405, 'POST required');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return error(415, 'JSON required');
    }
    let payload;
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return error(413, 'Request too large');
      payload = JSON.parse(body);
    } catch {
      return error(400, 'Invalid JSON');
    }
    const queries = Array.isArray(payload) ? payload : [payload];
    if (queries.length === 0 || queries.length > MAX_QUERIES) return error(400, 'Invalid batch size');
    for (const query of queries) {
      if (!query || typeof query !== 'object' || typeof query.sql !== 'string' || !query.sql.trim()) {
        return error(400, 'Invalid query');
      }
      if (query.params !== undefined && (!Array.isArray(query.params) || query.params.some(
        (value) => value !== null && typeof value !== 'string' &&
          !(typeof value === 'number' && Number.isFinite(value)),
      ))) return error(400, 'Invalid query parameters');
    }
    try {
      const statements = queries.map(({ sql, params = [] }) => env.DB.prepare(sql).bind(...params));
      // D1 batch được Cloudflare đảm bảo transaction: một câu lỗi sẽ rollback cả batch.
      const result = await env.DB.batch(statements);
      return Response.json(
        { success: true, errors: [], result },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } catch {
      // Không phản chiếu SQL, tham số, nội dung hòm thư hoặc token vào lỗi HTTP.
      return error(400, 'Database operation failed');
    }
  },
};
