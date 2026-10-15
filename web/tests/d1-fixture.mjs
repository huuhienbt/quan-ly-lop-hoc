import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/**
 * Runs application SQL against a new in-memory database for each test. Fetch is
 * replaced only within this process: no credentials or real D1 database are used.
 * Worker DB.batch() is transactional; this fixture models that documented contract.
 */
export function createD1Fixture() {
  const database = new DatabaseSync(":memory:");
  const migrations = new URL("../../database/migrations/", import.meta.url);
  for (const migration of readdirSync(migrations).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    database.exec(readFileSync(new URL(migration, migrations), "utf8"));
  }
  const originalFetch = globalThis.fetch;
  const previousEnvironment = new Map();
  const testEnvironment = {
    D1_GATEWAY_URL: "https://test-gateway.example.test/query",
    D1_GATEWAY_TOKEN: "test-token-only-for-isolated-node-tests",
    D1_LOCAL_API_URL: undefined,
    D1_LOCAL_API_TOKEN: undefined,
    SUPER_ADMIN_EMAILS: "",
    NODE_ENV: "test",
    NEXTAUTH_SECRET: "test-secret-only-for-isolated-node-tests",
    NEXTAUTH_URL: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "test-google-client",
    GOOGLE_CLIENT_SECRET: "test-google-secret",
  };
  for (const [name, value] of Object.entries(testEnvironment)) {
    previousEnvironment.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  const requests = [];
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url !== testEnvironment.D1_GATEWAY_URL) {
      throw new Error(`Unexpected outbound request in isolated test: ${url}`);
    }
    const payload = JSON.parse(options.body);
    const statements = Array.isArray(payload) ? payload : [payload];
    requests.push(...statements);
    const result = [];
    try {
      database.exec("BEGIN");
      for (const { sql, params = [] } of statements) {
        const query = database.prepare(sql);
        const before = Number(
          database.prepare("SELECT total_changes() AS count").get().count,
        );
        const rows = query.columns().length > 0 ? query.all(...params) : [];
        if (query.columns().length === 0) query.run(...params);
        const after = Number(
          database.prepare("SELECT total_changes() AS count").get().count,
        );
        result.push({
          success: true,
          results: rows,
          meta: { changes: after - before, duration: 0 },
        });
      }
      database.exec("COMMIT");
      return Response.json({ success: true, errors: [], messages: [], result });
    } catch (error) {
      database.exec("ROLLBACK");
      return Response.json({
        success: false,
        errors: [{ code: 7500, message: error.message }],
        result: [],
      });
    }
  };

  return {
    database,
    requests,
    restore() {
      globalThis.fetch = originalFetch;
      for (const [name, value] of previousEnvironment) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      database.close();
    },
  };
}

export function insertUser(database, options = {}) {
  const user = {
    id: options.id ?? crypto.randomUUID(),
    email: options.email ?? `${crypto.randomUUID()}@example.com`,
    name: options.name ?? "Tài khoản kiểm thử",
    role: options.role ?? "PENDING",
    status: options.status ?? "ACTIVE",
  };
  database
    .prepare("INSERT INTO users (id, email, name, role, status) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, user.email, user.name, user.role, user.status);
  return user;
}

export function insertTeacherRequest(database, userId, options = {}) {
  const request = {
    id: options.id ?? crypto.randomUUID(),
    school_id: options.school_id ?? "school-ben-tre",
    status: options.status ?? "PENDING",
  };
  database
    .prepare(
      `INSERT INTO teacher_requests
         (id, user_id, school_id, status, reviewed_by, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      request.id,
      userId,
      request.school_id,
      request.status,
      options.reviewed_by ?? null,
      request.status === "PENDING" ? null : new Date().toISOString(),
    );
  return request;
}
