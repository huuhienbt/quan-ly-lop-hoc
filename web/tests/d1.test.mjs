import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { ConfigurationError, getDatabaseConfig, getSetupState } from "../src/lib/config.ts";
import { batch, D1Error, execute, query } from "../src/lib/d1.ts";
import { createD1Fixture } from "./d1-fixture.mjs";

let fixture;
beforeEach(() => { fixture = createD1Fixture(); });
afterEach(() => { fixture.restore(); });

test("production refuses a local database override even when a valid remote gateway is available", () => {
  process.env.NODE_ENV = "production";
  process.env.NEXTAUTH_URL = "https://e-class-vinhlong.vercel.app";
  process.env.D1_LOCAL_API_URL = "http://127.0.0.1:8787/query";
  process.env.D1_LOCAL_API_TOKEN = "local-test-token-with-at-least-32-characters";
  assert.throws(getDatabaseConfig, (error) => error instanceof ConfigurationError && error.missing.includes("D1_LOCAL_API_URL"));
  assert.equal(getSetupState().databaseReady, false);
  assert.equal(fixture.requests.length, 0);
});

test("local D1 supports loopback development only, without URL credentials or query strings", () => {
  process.env.D1_LOCAL_API_TOKEN = "local-test-token-with-at-least-32-characters";
  process.env.D1_LOCAL_API_URL = "http://127.0.0.1:8787/query";
  assert.equal(getDatabaseConfig().url, process.env.D1_LOCAL_API_URL);
  for (const value of [
    "http://other-host.example.test/query",
    "http://localhost:8787/query?token=bad",
    "http://user:password@localhost:8787/query",
    "http://localhost:8787/wrong-route",
  ]) {
    process.env.D1_LOCAL_API_URL = value;
    assert.throws(getDatabaseConfig, ConfigurationError);
  }
});

test("remote D1 requires HTTPS, the gateway query path and a strong server token", () => {
  for (const value of [
    "http://test-gateway.example.test/query",
    "https://user:password@test-gateway.example.test/query",
    "https://test-gateway.example.test/query?token=bad",
    "https://test-gateway.example.test/query#fragment",
    "https://test-gateway.example.test/wrong-route",
    "https://localhost/query",
  ]) {
    process.env.D1_GATEWAY_URL = value;
    assert.throws(getDatabaseConfig, ConfigurationError);
  }
  process.env.D1_GATEWAY_URL = "https://test-gateway.example.test/query";
  process.env.D1_GATEWAY_TOKEN = "too-short";
  assert.throws(getDatabaseConfig, (error) => error instanceof ConfigurationError && error.missing.includes("D1_GATEWAY_TOKEN"));
});

test("missing gateway configuration fails before any fetch", async () => {
  delete process.env.D1_GATEWAY_TOKEN;
  await assert.rejects(query("SELECT 1"), ConfigurationError);
  assert.equal(fixture.requests.length, 0);
  assert.equal(getSetupState().sessionReady, false);
});

test("gateway requests authenticate on the server and forbid redirect or cache reuse", async () => {
  const fixtureFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return fixtureFetch(url, options);
  };
  const rows = await query("SELECT name FROM schools WHERE id = ?", ["school-ben-tre"]);
  assert.equal(rows[0].name, "Trường Tiểu học Bến Tre");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.Authorization, `Bearer ${process.env.D1_GATEWAY_TOKEN}`);
  assert.equal(captured.options.cache, "no-store");
  assert.equal(captured.options.redirect, "error");
  assert.ok(captured.options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(captured.options.body).params, ["school-ben-tre"]);
});

test("network failures never replay uncertain writes or expose upstream details", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("credential-and-SQL-details-must-stay-private");
  };
  await assert.rejects(execute("UPDATE schools SET name = ?", ["Test"]), (error) => {
    assert.ok(error instanceof D1Error);
    assert.equal(error.kind, "network");
    assert.equal(error.message.includes("credential"), false);
    return true;
  });
  assert.equal(calls, 1);
});

test("HTTP errors and incomplete or unsuccessful batch envelopes fail closed", async () => {
  const responses = [
    new Response("upstream-secret", { status: 401 }),
    Response.json({ success: false, errors: [{ message: "upstream-secret" }], result: [] }),
    Response.json({ success: true, result: [] }),
    Response.json({ success: true, result: [{ success: false, results: [], meta: { changes: 0 } }] }),
    Response.json({ success: true, result: [{ success: true, results: [], meta: {} }] }),
  ];
  for (const response of responses) {
    globalThis.fetch = async () => response;
    await assert.rejects(batch([{ sql: "SELECT 1", params: [] }]), (error) => {
      assert.ok(error instanceof D1Error);
      assert.equal(error.message.includes("upstream-secret"), false);
      return true;
    });
  }
});
