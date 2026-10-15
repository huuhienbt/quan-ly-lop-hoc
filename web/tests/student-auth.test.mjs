import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
import {
  authorizeStudentCredentials,
  changeStudentPassword,
  DEFAULT_STUDENT_PASSWORD,
  normalizeVietnamPhone,
  StudentCredentialError,
} from "../src/lib/student-credentials.ts";
import { authOptions } from "../src/lib/auth.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

// Replace only NextAuth's request-session reader in this isolated test process.
// Application guards and SQL are real; production receives no test identity path.
const require = createRequire(import.meta.url);
const nextAuthPath = require.resolve("next-auth");
const realNextAuth = require("next-auth");
let requestSession = null;
require.cache[nextAuthPath].exports = {
  ...realNextAuth,
  getServerSession: async () => requestSession,
};
const { getCurrentStudentAccount, requireStudentAccount } = await import("../src/lib/student-session.ts");
const { getCurrentUser, requireSuperAdmin, requireClassTeacher } = await import("../src/lib/rbac.ts");
require.cache[nextAuthPath].exports = realNextAuth;

let fixture;
const defaultHash = await hashPassword(DEFAULT_STUDENT_PASSWORD);
const newPassword = "HanhPhuc-OnlyForTests-2026!";
beforeEach(() => {
  fixture = createD1Fixture();
  requestSession = null;
});
afterEach(() => { fixture.restore(); });

function seedAccount(options = {}) {
  const account = {
    id: options.id ?? "student-account-test-1",
    phone: options.phone ?? "0900000001",
    must_change_password: options.must_change_password ?? 1,
    session_version: options.session_version ?? 1,
    status: options.status ?? "ACTIVE",
  };
  fixture.database.prepare(`INSERT INTO student_accounts
    (id, phone, password_hash, must_change_password, session_version, status) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(account.id, account.phone, options.password_hash ?? defaultHash,
      account.must_change_password, account.session_version, account.status);
  return account;
}

function studentSession(account) {
  return { user: { id: "", kind: "student", studentAccountId: account.id, studentSessionVersion: account.session_version } };
}

function seedLinkedProfiles(account, ids = ["child-test-a"]) {
  const owner = insertUser(fixture.database, { role: "SUPER_ADMIN" });
  const yearId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  fixture.database.prepare(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES (?, 'school-ben-tre', ?, '2026-09-01', '2027-05-31')`).run(yearId, yearId);
  fixture.database.prepare(`INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
    VALUES (?, 'school-ben-tre', ?, ?, ?, 4, ?)`).run(classId, yearId, classId, classId, owner.id);
  for (const id of ids) {
    fixture.database.prepare("INSERT INTO students (id, school_id, full_name) VALUES (?, 'school-ben-tre', ?)")
      .run(id, `Học sinh giả lập ${id}`);
    fixture.database.prepare("INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)")
      .run(account.id, id);
    fixture.database.prepare(`INSERT INTO student_enrollments
      (id, student_id, class_id, school_id, academic_year_id, enrolled_on)
      VALUES (?, ?, ?, 'school-ben-tre', ?, '2026-09-01')`).run(crypto.randomUUID(), id, classId, yearId);
  }
  return { classId, yearId, owner };
}

test("Vietnamese mobile phone formats normalize to a single leading-zero identity", () => {
  for (const phone of ["0900000001", "+84900000001", "+84 900 000 001", "(0900) 000-001", "0900.000.001"]) {
    assert.equal(normalizeVietnamPhone(phone), "0900000001");
  }
  for (const phone of ["", null, undefined, 900000001, "0900000001oops", "090000001", "0200000001", "+10900000001"]) {
    assert.equal(normalizeVietnamPhone(phone), null);
  }
});

test("scrypt password hashes use independent salts and reject mismatches or malformed parameters", async () => {
  const first = await hashPassword(DEFAULT_STUDENT_PASSWORD);
  const second = await hashPassword(DEFAULT_STUDENT_PASSWORD);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(DEFAULT_STUDENT_PASSWORD, first), true);
  assert.equal(await verifyPassword("different-password", first), false);
  assert.equal(first.includes(DEFAULT_STUDENT_PASSWORD), false);
  for (const encoded of ["", "plaintext-password", `${first}\n`, first.replace("$16384$", "$1073741824$"), first.slice(0, -1)]) {
    assert.equal(await verifyPassword(DEFAULT_STUDENT_PASSWORD, encoded), false);
  }
  await assert.rejects(hashPassword(""), RangeError);
  await assert.rejects(hashPassword("x".repeat(129)), RangeError);
});

test("a valid phone login returns a student identity without creating staff or Google records", async () => {
  const account = seedAccount();
  const user = await authorizeStudentCredentials({ phone: "+84 900 000 001", password: DEFAULT_STUDENT_PASSWORD });
  assert.deepEqual(user, { id: account.id, kind: "student", studentAccountId: account.id, studentSessionVersion: 1 });
  for (const table of ["users", "accounts", "teacher_requests"]) {
    assert.equal(fixture.database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  }
  const stored = fixture.database.prepare("SELECT * FROM student_accounts WHERE id = ?").get(account.id);
  assert.ok(stored.last_login_at);
  assert.equal(stored.failed_attempts, 0);
  assert.equal(stored.must_change_password, 1);
});

test("unknown phone, wrong password, suspended account and database failure share a null login result", async () => {
  const account = seedAccount();
  assert.equal(await authorizeStudentCredentials({ phone: "0900000002", password: DEFAULT_STUDENT_PASSWORD }), null);
  assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: "wrong-password" }), null);
  fixture.database.prepare("UPDATE student_accounts SET status = 'SUSPENDED' WHERE id = ?").run(account.id);
  assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: DEFAULT_STUDENT_PASSWORD }), null);
  globalThis.fetch = async () => { throw new Error("private upstream credentials and SQL"); };
  assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: DEFAULT_STUDENT_PASSWORD }), null);
});

test("malformed phone and password inputs fail without spending an account attempt", async () => {
  const account = seedAccount();
  for (const credentials of [undefined, {}, { phone: account.phone },
    { phone: account.phone, password: 123456789 }, { phone: account.phone, password: "x".repeat(129) },
    { phone: "not-a-phone", password: DEFAULT_STUDENT_PASSWORD }]) {
    assert.equal(await authorizeStudentCredentials(credentials), null);
  }
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.database.prepare("SELECT failed_attempts FROM student_accounts WHERE id = ?").get(account.id).failed_attempts, 0);
});

test("five failed attempts lock that phone even when the next password is correct", async () => {
  const account = seedAccount();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: "wrong-password" }), null);
  }
  const locked = fixture.database.prepare("SELECT failed_attempts, locked_until FROM student_accounts WHERE id = ?").get(account.id);
  assert.equal(locked.failed_attempts, 5);
  assert.ok(Date.parse(locked.locked_until) > Date.now());
  assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: DEFAULT_STUDENT_PASSWORD }), null);
  assert.equal(fixture.database.prepare("SELECT failed_attempts FROM student_accounts WHERE id = ?").get(account.id).failed_attempts, 5);
});

test("parallel failures cannot reserve more than five attempts for one phone or lock a different phone", async () => {
  const first = seedAccount();
  const second = seedAccount({ id: "student-account-test-2", phone: "0900000002" });
  const results = await Promise.all(Array.from({ length: 8 }, () =>
    authorizeStudentCredentials({ phone: first.phone, password: "wrong-password" })));
  assert.ok(results.every((result) => result === null));
  assert.equal(fixture.database.prepare("SELECT failed_attempts FROM student_accounts WHERE id = ?").get(first.id).failed_attempts, 5);
  assert.equal(await authorizeStudentCredentials({ phone: first.phone, password: DEFAULT_STUDENT_PASSWORD }), null);
  assert.equal((await authorizeStudentCredentials({ phone: second.phone, password: DEFAULT_STUDENT_PASSWORD })).id, second.id);
});

test("an expired failure window permits a correct password and clears its old throttle state", async () => {
  const account = seedAccount();
  const expired = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  fixture.database.prepare(`UPDATE student_accounts SET failed_attempts = 5,
    failure_window_started_at = ?, locked_until = ? WHERE id = ?`).run(expired, expired, account.id);
  assert.equal((await authorizeStudentCredentials({ phone: account.phone, password: DEFAULT_STUDENT_PASSWORD })).id, account.id);
  const stored = fixture.database.prepare("SELECT failed_attempts, locked_until, failure_window_started_at FROM student_accounts WHERE id = ?").get(account.id);
  assert.equal(stored.failed_attempts, 0);
  assert.equal(stored.locked_until, null);
  assert.equal(stored.failure_window_started_at, null);
});

test("default-password sessions expose no pupil records and must change password before protected access", async () => {
  const account = seedAccount();
  seedLinkedProfiles(account);
  requestSession = studentSession(account);
  const current = await getCurrentStudentAccount();
  assert.equal(current.must_change_password, true);
  assert.deepEqual(current.students, []);
  await assert.rejects(requireStudentAccount(), (error) => error.status === 403 && error.code === "PASSWORD_CHANGE_REQUIRED");
  assert.equal((await requireStudentAccount({ allowPasswordChange: true })).id, account.id);
});

test("new passwords reject the default, unchanged value and values shorter than eight characters", async () => {
  const account = seedAccount();
  for (const password of [DEFAULT_STUDENT_PASSWORD, "short", ""]) {
    await assert.rejects(changeStudentPassword(account.id, 1, DEFAULT_STUDENT_PASSWORD, password), StudentCredentialError);
  }
  const strongHash = await hashPassword(newPassword);
  fixture.database.prepare("UPDATE student_accounts SET password_hash = ? WHERE id = ?").run(strongHash, account.id);
  await assert.rejects(changeStudentPassword(account.id, 1, newPassword, newPassword), StudentCredentialError);
  const stored = fixture.database.prepare("SELECT password_hash, session_version, must_change_password FROM student_accounts WHERE id = ?").get(account.id);
  assert.equal(stored.password_hash, strongHash);
  assert.equal(stored.session_version, 1);
  assert.equal(stored.must_change_password, 1);
});

test("a successful password change clears the mandatory flag and revokes every old session version", async () => {
  const account = seedAccount();
  await changeStudentPassword(account.id, 1, DEFAULT_STUDENT_PASSWORD, newPassword);
  const stored = fixture.database.prepare("SELECT * FROM student_accounts WHERE id = ?").get(account.id);
  assert.equal(stored.must_change_password, 0);
  assert.equal(stored.session_version, 2);
  assert.ok(stored.password_changed_at);
  assert.equal(await verifyPassword(newPassword, stored.password_hash), true);
  assert.equal(await verifyPassword(DEFAULT_STUDENT_PASSWORD, stored.password_hash), false);
  requestSession = studentSession(account);
  assert.equal(await getCurrentStudentAccount(), null);
  await assert.rejects(requireStudentAccount(), (error) => error.status === 401);
  const login = await authorizeStudentCredentials({ phone: account.phone, password: newPassword });
  assert.equal(login.studentSessionVersion, 2);
});

test("concurrent password changes use compare-and-swap so only one new password can win", async () => {
  const account = seedAccount();
  const alternatives = [newPassword, "Another-OnlyForTests-2026!"];
  const results = await Promise.allSettled(alternatives.map((password) =>
    changeStudentPassword(account.id, 1, DEFAULT_STUDENT_PASSWORD, password)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const stored = fixture.database.prepare("SELECT password_hash, session_version FROM student_accounts WHERE id = ?").get(account.id);
  assert.equal(stored.session_version, 2);
  const accepted = await Promise.all(alternatives.map((password) => verifyPassword(password, stored.password_hash)));
  assert.equal(accepted.filter(Boolean).length, 1);
});

test("incorrect current-password changes consume the same per-account throttle as login", async () => {
  const account = seedAccount();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(changeStudentPassword(account.id, 1, "wrong-password", newPassword), StudentCredentialError);
  }
  await assert.rejects(changeStudentPassword(account.id, 1, DEFAULT_STUDENT_PASSWORD, newPassword), StudentCredentialError);
  assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: DEFAULT_STUDENT_PASSWORD }), null);
  const stored = fixture.database.prepare("SELECT failed_attempts, session_version, must_change_password FROM student_accounts WHERE id = ?").get(account.id);
  assert.equal(stored.failed_attempts, 5);
  assert.equal(stored.session_version, 1);
  assert.equal(stored.must_change_password, 1);
});

test("student sessions cannot gain staff access by carrying a real administrator id or role claim", async () => {
  const administrator = insertUser(fixture.database, { role: "SUPER_ADMIN" });
  fixture.database.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(new Date().toISOString(), administrator.id);
  requestSession = { user: { id: administrator.id } };
  assert.equal((await getCurrentUser()).role, "SUPER_ADMIN");
  requestSession = { user: { id: administrator.id, kind: "student", role: "SUPER_ADMIN", studentAccountId: "student-account-test-1", studentSessionVersion: 1 } };
  assert.equal(await getCurrentUser(), null);
  await assert.rejects(requireSuperAdmin(), (error) => error.status === 401);
  await assert.rejects(requireClassTeacher("class-test"), (error) => error.status === 401);
});

test("student identity claims stay separate from staff claims through NextAuth JWT and client updates", async () => {
  const account = seedAccount();
  const user = await authorizeStudentCredentials({ phone: account.phone, password: DEFAULT_STUDENT_PASSWORD });
  const token = await authOptions.callbacks.jwt({
    token: { userId: "administrator-id", role: "SUPER_ADMIN" },
    user,
    account: { provider: "student", type: "credentials" },
  });
  assert.equal(token.userId, undefined);
  assert.equal(token.studentAccountId, account.id);
  assert.equal(token.studentSessionVersion, 1);
  const unchanged = await authOptions.callbacks.jwt({
    token,
    trigger: "update",
    session: { userId: "administrator-id", kind: "staff", studentSessionVersion: 999 },
  });
  assert.deepEqual(unchanged, token);
  const session = await authOptions.callbacks.session({ session: { user: { id: "administrator-id", role: "SUPER_ADMIN" } }, token });
  assert.equal(session.user.id, "");
  assert.equal(session.user.kind, "student");
  assert.equal(session.user.studentAccountId, account.id);
  assert.equal(session.user.role, undefined);
});

test("the student NextAuth provider uses credential validation rather than the Google identity path", async () => {
  const account = seedAccount();
  const provider = authOptions.providers.find((item) => item.id === "student" || item.options?.id === "student");
  assert.ok(provider, "Student credentials provider must be registered");
  const authorize = provider.options?.authorize ?? provider.authorize;
  const user = await authorize({ phone: account.phone, password: DEFAULT_STUDENT_PASSWORD }, {});
  assert.equal(user.studentAccountId, account.id);
  assert.equal(await authOptions.callbacks.signIn({ user, account: { provider: "student", type: "credentials" } }), true);
  for (const table of ["users", "accounts", "teacher_requests"]) {
    assert.equal(fixture.database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  }
});

test("client-shaped student objects cannot bypass the provider's credential verification", async () => {
  const forgedUser = { id: "administrator-id", kind: "student", studentAccountId: "administrator-id", studentSessionVersion: 1 };
  assert.equal(await authOptions.callbacks.signIn({ user: forgedUser, account: { provider: "student", type: "credentials" } }), false);
  assert.equal(fixture.requests.length, 0);
});

test("staff sessions and malformed student versions cannot impersonate a family account", async () => {
  const account = seedAccount({ must_change_password: 0 });
  for (const user of [
    { id: account.id, studentAccountId: account.id, studentSessionVersion: 1 },
    { id: "", kind: "student", studentAccountId: account.id, studentSessionVersion: "1" },
    { id: "", kind: "student", studentAccountId: account.id, studentSessionVersion: 2 },
    { id: "", kind: "student", studentAccountId: "another-account", studentSessionVersion: 1 },
  ]) {
    requestSession = { user };
    assert.equal(await getCurrentStudentAccount(), null);
  }
});

test("a family sees only its linked active pupils, including siblings, rather than another family's pupil", async () => {
  const first = seedAccount({ must_change_password: 0 });
  const second = seedAccount({ id: "student-account-test-2", phone: "0900000002", must_change_password: 0 });
  seedLinkedProfiles(first, ["child-test-a", "child-test-a-sibling"]);
  seedLinkedProfiles(second, ["child-test-b"]);
  requestSession = studentSession(first);
  const current = await requireStudentAccount();
  assert.deepEqual(current.students.map((student) => student.id).sort(), ["child-test-a", "child-test-a-sibling"]);
  assert.equal(JSON.stringify(current).includes("child-test-b"), false);
  requestSession = studentSession(second);
  assert.deepEqual((await requireStudentAccount()).students.map((student) => student.id), ["child-test-b"]);
});

test("archived pupils or classrooms and suspended accounts disappear from student access", async () => {
  const account = seedAccount({ must_change_password: 0 });
  const { classId } = seedLinkedProfiles(account, ["child-test-a", "child-test-a-sibling"]);
  requestSession = studentSession(account);
  fixture.database.prepare("UPDATE students SET archived_at = ? WHERE id = ?").run(new Date().toISOString(), "child-test-a");
  assert.deepEqual((await getCurrentStudentAccount()).students.map((student) => student.id), ["child-test-a-sibling"]);
  fixture.database.prepare("UPDATE classes SET archived_at = ? WHERE id = ?").run(new Date().toISOString(), classId);
  assert.deepEqual((await getCurrentStudentAccount()).students, []);
  fixture.database.prepare("UPDATE student_accounts SET status = 'SUSPENDED' WHERE id = ?").run(account.id);
  assert.equal(await getCurrentStudentAccount(), null);
});
