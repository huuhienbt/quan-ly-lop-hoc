import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import {
  getSiteTheme, getSiteThemeSettings, SiteThemeActionError, updateSiteTheme,
} from "../src/lib/site-theme.ts";
import { siteThemeFormSchema, siteThemeUpdateSchema } from "../src/lib/theme-schemas.ts";
import { hashPassword } from "../src/lib/password.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

const fixturePasswordHash = await hashPassword("Only-For-Theme-Fixtures-2026!");

// Only framework request/cache edges are replaced. All guards, schema parsing,
// mutation SQL and atomic D1 behavior below use the actual application modules.
const require = createRequire(import.meta.url);
const nextAuthPath = require.resolve("next-auth");
const realNextAuth = require("next-auth");
const nextCachePath = require.resolve("next/cache");
const realNextCache = require("next/cache");
let requestSession = null;
let revalidations = [];
require.cache[nextAuthPath].exports = {
  ...realNextAuth, getServerSession: async () => requestSession,
};
require.cache[nextCachePath].exports = {
  ...realNextCache, revalidatePath: (...args) => { revalidations.push(args); },
};
const { applySiteTheme } = await import("../src/app/admin/theme-actions.ts");
require.cache[nextAuthPath].exports = realNextAuth;
require.cache[nextCachePath].exports = realNextCache;

let fixture;
let administrator;
beforeEach(() => {
  fixture = createD1Fixture();
  administrator = seedUser({ role: "SUPER_ADMIN" });
  requestSession = null;
  revalidations = [];
});
afterEach(() => { fixture.restore(); });

function seedUser(options = {}) {
  const user = insertUser(fixture.database, options);
  if (options.verified !== false) {
    fixture.database.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?")
      .run("2026-10-15T00:00:00.000Z", user.id);
  }
  return user;
}

function setting() {
  return fixture.database.prepare("SELECT * FROM site_settings WHERE id = 'site'").get();
}

function audits() {
  return fixture.database.prepare("SELECT * FROM audit_logs WHERE action = 'SITE_THEME_UPDATED' ORDER BY rowid").all();
}

function themeForm(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ theme: "discovery", revision: "1", ...overrides })) {
    data.append(key, value);
  }
  return data;
}

function otherDataSnapshot() {
  const tables = fixture.database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'
    AND name NOT IN ('site_settings', 'audit_logs') ORDER BY name`).all();
  return tables.map(({ name }) => [name, fixture.database.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]);
}

test("migration retains Theme 1 until a verified administrator explicitly changes it", async () => {
  assert.equal(setting().site_theme, "playful");
  assert.equal(setting().revision, 1);
  assert.equal(setting().updated_by, null);
  assert.equal((await getSiteThemeSettings()).theme, "playful");
  assert.equal(await getSiteTheme(), "playful");
  assert.equal(audits().length, 0);
});

test("Theme 1 can be restored after Theme 2 without rewriting existing classroom data", async () => {
  fixture.database.exec(`
    INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
      VALUES ('theme-year', 'school-ben-tre', 'Theme fixture year', '2026-09-01', '2027-05-31');
    INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
      VALUES ('theme-class', 'school-ben-tre', 'theme-year', 'Theme fixture class', 'theme-fixture-class', 4, '${administrator.id}');
    INSERT INTO students (id, school_id, full_name) VALUES ('theme-pupil', 'school-ben-tre', 'Synthetic theme pupil');
    INSERT INTO student_enrollments (id, student_id, class_id, school_id, academic_year_id, enrolled_on)
      VALUES ('theme-enrollment', 'theme-pupil', 'theme-class', 'school-ben-tre', 'theme-year', '2026-09-01');
    INSERT INTO posts (id, class_id, author_id, title, body)
      VALUES ('theme-post', 'theme-class', '${administrator.id}', 'Existing classroom post', 'Keep this content intact.');
    INSERT INTO class_tasks (id, class_id, title, kind, created_by)
      VALUES ('theme-task', 'theme-class', 'Existing task', 'TODO', '${administrator.id}');
    INSERT INTO student_task_completions (task_id, enrollment_id, class_id, completion_date)
      VALUES ('theme-task', 'theme-enrollment', 'theme-class', '2026-10-15');
  `);
  fixture.database.prepare(`INSERT INTO student_accounts (id, phone, password_hash, must_change_password)
    VALUES ('theme-student-account', '0900000001', ?, 0)`).run(fixturePasswordHash);
  fixture.database.prepare(`INSERT INTO student_account_students (account_id, student_id)
    VALUES ('theme-student-account', 'theme-pupil')`).run();
  const before = otherDataSnapshot();
  const discovery = await updateSiteTheme(administrator.id, { theme: "discovery", revision: 1 });
  assert.equal(discovery.theme, "discovery");
  assert.equal(discovery.revision, 2);
  assert.equal(await getSiteTheme(), "discovery");
  const restored = await updateSiteTheme(administrator.id, { theme: "playful", revision: 2 });
  assert.equal(restored.theme, "playful");
  assert.equal(restored.revision, 3);
  assert.equal(restored.updated_by, administrator.id);
  assert.equal(await getSiteTheme(), "playful");
  assert.deepEqual(otherDataSnapshot(), before);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM site_settings").get().n, 1);
  assert.deepEqual(audits().map(({ actor_user_id, entity_type, entity_id, details_json }) => ({
    actor_user_id, entity_type, entity_id, details: JSON.parse(details_json),
  })), [
    { actor_user_id: administrator.id, entity_type: "site_settings", entity_id: "site", details: { theme: "discovery", revision: 2 } },
    { actor_user_id: administrator.id, entity_type: "site_settings", entity_id: "site", details: { theme: "playful", revision: 3 } },
  ]);
  assert.deepEqual(fixture.database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("mutation checks current verified active Super Admin role in SQL", async () => {
  const cases = [
    { role: "TEACHER" }, { role: "PENDING" },
    { role: "SUPER_ADMIN", status: "SUSPENDED" },
    { role: "SUPER_ADMIN", verified: false },
  ];
  const initial = setting();
  for (const options of cases) {
    const user = seedUser(options);
    await assert.rejects(updateSiteTheme(user.id, { theme: "discovery", revision: 1 }),
      (error) => error instanceof SiteThemeActionError && error.kind === "forbidden");
    assert.deepEqual(setting(), initial);
  }
  for (const actorId of ["missing-user", "", null, 123, "' OR 1=1 --"]) {
    await assert.rejects(updateSiteTheme(actorId, { theme: "discovery", revision: 1 }),
      (error) => error instanceof SiteThemeActionError && error.kind === "forbidden");
  }
  assert.equal(audits().length, 0);
});

test("a stale editor cannot overwrite a later choice or append a misleading audit", async () => {
  await updateSiteTheme(administrator.id, { theme: "discovery", revision: 1 });
  await assert.rejects(updateSiteTheme(administrator.id, { theme: "playful", revision: 1 }),
    (error) => error instanceof SiteThemeActionError && error.kind === "conflict" && /tải lại/.test(error.message));
  assert.equal(setting().site_theme, "discovery");
  assert.equal(setting().revision, 2);
  assert.equal(audits().length, 1);
});

test("concurrent editors using the same revision produce one successful change", async () => {
  const outcomes = await Promise.allSettled([
    updateSiteTheme(administrator.id, { theme: "discovery", revision: 1 }),
    updateSiteTheme(administrator.id, { theme: "playful", revision: 1 }),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const rejected = outcomes.find((outcome) => outcome.status === "rejected");
  assert.equal(rejected.reason.kind, "conflict");
  assert.equal(setting().revision, 2);
  assert.equal(audits().length, 1);
});

test("audit failure rolls back the theme and revision together", async () => {
  const initial = setting();
  fixture.database.exec(`CREATE TEMP TRIGGER reject_theme_audit BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'SITE_THEME_UPDATED'
    BEGIN SELECT RAISE(ABORT, 'intentional isolated theme audit failure'); END`);
  await assert.rejects(updateSiteTheme(administrator.id, { theme: "discovery", revision: 1 }));
  assert.deepEqual(setting(), initial);
  assert.equal(audits().length, 0);
});

test("invalid theme, revision and extra fields are rejected before a mutation request", async () => {
  const badInputs = [
    { theme: "unknown", revision: 1 }, { theme: "DISCOVERY", revision: 1 },
    { theme: "discovery", revision: "1" }, { theme: "discovery", revision: 0 },
    { theme: "discovery", revision: -1 }, { theme: "discovery", revision: 1.1 },
    { theme: "discovery", revision: true }, { theme: "discovery", revision: NaN },
    { theme: "discovery", revision: Number.MAX_SAFE_INTEGER },
    { theme: "discovery", revision: Number.MAX_SAFE_INTEGER + 1 },
    { theme: "discovery", revision: 1, actorId: administrator.id },
  ];
  for (const input of badInputs) {
    assert.equal(siteThemeUpdateSchema.safeParse(input).success, false);
    await assert.rejects(updateSiteTheme(administrator.id, input),
      (error) => error instanceof SiteThemeActionError && error.kind === "invalid");
  }
  assert.equal(fixture.requests.length, 0);
  assert.equal(setting().revision, 1);
  assert.equal(audits().length, 0);
});

test("form parsing accepts only canonical positive integer revision text", () => {
  assert.deepEqual(siteThemeFormSchema.parse({ theme: "discovery", revision: "2" }), { theme: "discovery", revision: 2 });
  for (const revision of ["", " 1", "1 ", "01", "0", "-1", "1.0", "1.1", "1e2", "true", "9007199254740991", "9007199254740992", 1, true]) {
    assert.equal(siteThemeFormSchema.safeParse({ theme: "discovery", revision }).success, false);
  }
});

test("public reads fall back to Theme 1 during outages while the editor read fails visibly", async () => {
  await updateSiteTheme(administrator.id, { theme: "discovery", revision: 1 });
  globalThis.fetch = async () => { throw new Error("isolated simulated network outage"); };
  assert.equal(await getSiteTheme(), "playful");
  await assert.rejects(getSiteThemeSettings());
  assert.equal(setting().site_theme, "discovery");
  assert.equal(setting().revision, 2);
});

test("a missing settings row is unavailable to the editor and does not get silently recreated", async () => {
  fixture.database.prepare("DELETE FROM site_settings").run();
  assert.equal(await getSiteTheme(), "playful");
  await assert.rejects(getSiteThemeSettings(), (error) => error.kind === "unavailable");
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM site_settings").get().n, 0);
});

test("the real action rejects anonymous, staff without permission and forged student sessions", async () => {
  const teacher = seedUser({ role: "TEACHER" });
  const pending = seedUser({ role: "PENDING" });
  const suspended = seedUser({ role: "SUPER_ADMIN", status: "SUSPENDED" });
  const unverified = seedUser({ role: "SUPER_ADMIN", verified: false });
  for (const user of [null, teacher, pending, suspended, unverified]) {
    requestSession = user ? { user: { id: user.id, role: "SUPER_ADMIN" } } : null;
    const result = await applySiteTheme({ success: false, message: "" }, themeForm());
    assert.equal(result.success, false);
  }
  requestSession = { user: { id: administrator.id, kind: "student", role: "SUPER_ADMIN", studentAccountId: "synthetic-student" } };
  const forged = await applySiteTheme({ success: false, message: "" }, themeForm());
  assert.equal(forged.success, false);
  assert.equal(setting().revision, 1);
  assert.equal(audits().length, 0);
  assert.deepEqual(revalidations, []);
});

test("the real action rejects duplicate and unknown fields without a partial save", async () => {
  requestSession = { user: { id: administrator.id } };
  const duplicateTheme = themeForm(); duplicateTheme.append("theme", "playful");
  const duplicateRevision = themeForm(); duplicateRevision.append("revision", "2");
  for (const form of [duplicateTheme, duplicateRevision, themeForm({ unexpected: "injected" }), themeForm({ revision: "0" }), themeForm({ theme: "invalid" })]) {
    const result = await applySiteTheme({ success: false, message: "" }, form);
    assert.equal(result.success, false);
  }
  assert.equal(setting().revision, 1);
  assert.equal(audits().length, 0);
  assert.deepEqual(revalidations, []);
});

test("the real action saves a verified Super Admin choice and revalidates all layouts", async () => {
  requestSession = { user: { id: administrator.id } };
  const form = themeForm(); form.append("$ACTION_ID_fixture", "framework-only");
  const result = await applySiteTheme({ success: false, message: "" }, form);
  assert.equal(result.success, true);
  assert.match(result.message, /Giao diện 2/);
  assert.equal(setting().site_theme, "discovery");
  assert.equal(setting().revision, 2);
  assert.equal(audits().length, 1);
  assert.deepEqual(revalidations, [["/", "layout"]]);
  const stale = await applySiteTheme({ success: false, message: "" }, themeForm({ theme: "playful" }));
  assert.equal(stale.success, false);
  assert.match(stale.message, /tải lại/);
  assert.equal(setting().site_theme, "discovery");
  assert.equal(audits().length, 1);
  assert.deepEqual(revalidations, [["/", "layout"]]);
});

test("an administrator suspended after the session check cannot change the global theme", async () => {
  requestSession = { user: { id: administrator.id } };
  const fixtureFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const payload = JSON.parse(options.body);
    if (Array.isArray(payload) && payload[0].sql.startsWith("UPDATE site_settings")) {
      fixture.database.prepare("UPDATE users SET status = 'SUSPENDED' WHERE id = ?").run(administrator.id);
    }
    return fixtureFetch(input, options);
  };
  const result = await applySiteTheme({ success: false, message: "" }, themeForm());
  assert.equal(result.success, false);
  assert.match(result.message, /quyền/);
  assert.equal(setting().site_theme, "playful");
  assert.equal(setting().revision, 1);
  assert.equal(audits().length, 0);
  assert.deepEqual(revalidations, []);
});

test("failed action does not acknowledge a save, revalidate or expose internal database errors", async () => {
  requestSession = { user: { id: administrator.id } };
  fixture.database.exec(`CREATE TEMP TRIGGER reject_theme_audit BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'SITE_THEME_UPDATED'
    BEGIN SELECT RAISE(ABORT, 'PRIVATE_DATABASE_DETAIL'); END`);
  const result = await applySiteTheme({ success: true, message: "Previous successful choice" }, themeForm());
  assert.equal(result.success, false);
  assert.equal(result.message.includes("PRIVATE_DATABASE_DETAIL"), false);
  assert.equal(setting().site_theme, "playful");
  assert.equal(setting().revision, 1);
  assert.equal(audits().length, 0);
  assert.deepEqual(revalidations, []);
});
