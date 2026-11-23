import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
import { authorizeStudentCredentials, changeStudentPassword } from "../src/lib/student-credentials.ts";
import { getTeacherStudentRoster, resetTeacherStudentPassword, TeacherStudentError } from "../src/lib/teacher-students.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

const require = createRequire(import.meta.url);
const nextAuthPath = require.resolve("next-auth");
const originalAuth = require("next-auth");
const nextCachePath = require.resolve("next/cache");
const originalCache = require("next/cache");
let requestSession;
let revalidated;
require.cache[nextAuthPath].exports = { ...originalAuth, getServerSession: async () => requestSession };
require.cache[nextCachePath].exports = { ...originalCache, revalidatePath: path => revalidated.push(path) };
const { resetStudentPasswordAction } = await import("../src/app/teacher/student-actions.ts");
const { getCurrentStudentAccount, requireStudentAccount } = await import("../src/lib/student-session.ts");
require.cache[nextAuthPath].exports = originalAuth;
require.cache[nextCachePath].exports = originalCache;

const initialPassword = "Only-For-Local-Roster-Fixtures";
const initialHash = await hashPassword(initialPassword);
const idle = { kind: "idle" };
let fixture;
let admin;
let teacher;

beforeEach(() => {
  fixture = createD1Fixture();
  requestSession = null;
  revalidated = [];
  admin = seedUser("SUPER_ADMIN");
  teacher = seedUser("TEACHER");
  const db = fixture.database;
  db.prepare(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES ('fixture-year', 'school-ben-tre', 'Năm mẫu', '2026-09-01', '2027-05-31')`).run();
  for (const id of ["class-a", "class-b"]) {
    db.prepare(`INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
      VALUES (?, 'school-ben-tre', 'fixture-year', ?, ?, 4, ?)`).run(id, id, id, admin.id);
  }
  db.prepare("INSERT INTO class_teachers (class_id, user_id, assigned_by) VALUES ('class-a', ?, ?)").run(teacher.id, admin.id);
});
afterEach(() => fixture.restore());

function seedUser(role, { status = "ACTIVE", verified = true } = {}) {
  const user = insertUser(fixture.database, { role, status });
  if (verified) fixture.database.prepare("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);
  return user;
}

function seedAccount(n, status = "ACTIVE") {
  const id = "sample-login-" + n;
  const phone = "090000000" + n;
  fixture.database.prepare(`INSERT INTO student_accounts (id, phone, password_hash, must_change_password, status)
    VALUES (?, ?, ?, 0, ?)`).run(id, phone, initialHash, status);
  return { id, phone };
}

function seedPupil(n, classroom, account) {
  const id = "sample-child-" + n;
  const enrollment = "sample-enrollment-" + n;
  const name = "Học sinh giả lập " + n;
  fixture.database.prepare("INSERT INTO students (id, school_id, full_name) VALUES (?, 'school-ben-tre', ?)").run(id, name);
  fixture.database.prepare(`INSERT INTO student_enrollments
    (id, student_id, class_id, school_id, academic_year_id, student_number, enrolled_on)
    VALUES (?, ?, ?, 'school-ben-tre', 'fixture-year', ?, '2026-09-01')`).run(enrollment, id, classroom, n);
  if (account) fixture.database.prepare("INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)").run(account.id, id);
  return { id, enrollment, name, classroom };
}

function stored(account) {
  return fixture.database.prepare("SELECT * FROM student_accounts WHERE id = ?").get(account.id);
}

function audits() {
  return fixture.database.prepare("SELECT * FROM audit_logs WHERE action = 'STUDENT_PASSWORD_RESET'").all();
}

function selection(pupil, account) {
  return { class_id: pupil.classroom, enrollment_id: pupil.enrollment, account_id: account.id, session_version: 1 };
}

function form(pupil, account, overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...selection(pupil, account), confirmed: "yes", ...overrides })) {
    if (value !== undefined) data.append(key, String(value));
  }
  return data;
}

function signedInStudent(user) {
  return { user: { id: "", kind: "student", studentAccountId: user.studentAccountId, studentSessionVersion: user.studentSessionVersion } };
}

test("roster lists only assigned, active pupils, includes unlinked pupils, and does not contain password data", async () => {
  const account = seedAccount(1);
  const pupil = seedPupil(1, "class-a", account);
  const unlinked = seedPupil(2, "class-a");
  const archived = seedPupil(3, "class-a");
  seedPupil(4, "class-b", seedAccount(4));
  fixture.database.prepare("UPDATE students SET archived_at = CURRENT_TIMESTAMP WHERE id = ?").run(archived.id);
  const rows = await getTeacherStudentRoster(teacher.id, "class-a");
  assert.deepEqual(rows.map(row => [row.full_name, row.phone, row.can_reset]),
    [[pupil.name, account.phone, 1], [unlinked.name, null, 0]]);
  assert(rows.every(row => !("password_hash" in row) && !("temporaryPassword" in row)));
  assert.deepEqual(await getTeacherStudentRoster(teacher.id, "class-b"), []);
  assert.equal((await getTeacherStudentRoster(admin.id, "class-b")).length, 1);
  assert.deepEqual(await getTeacherStudentRoster(seedUser("PENDING").id, "class-a"), []);
  fixture.database.prepare("UPDATE class_teachers SET ended_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(teacher.id);
  assert.deepEqual(await getTeacherStudentRoster(teacher.id, "class-a"), []);
});

test("confirmed reset logs out the old session and requires password change before the pupil can see records", async () => {
  const account = seedAccount(1);
  const siblingAccount = seedAccount(2);
  const pupil = seedPupil(1, "class-a", account);
  seedPupil(2, "class-a", siblingAccount);
  const otherBefore = stored(siblingAccount);
  const originalUser = await authorizeStudentCredentials({ phone: account.phone, password: initialPassword });
  assert(originalUser, "sample account should be able to log in");
  fixture.database.prepare(`UPDATE student_accounts SET failed_attempts=5, failure_window_started_at=CURRENT_TIMESTAMP,
    locked_until='2099-01-01T00:00:00.000Z' WHERE id=?`).run(account.id);

  requestSession = { user: { id: teacher.id } };
  const result = await resetStudentPasswordAction(idle, form(pupil, account));
  assert.equal(result.kind, "success");
  assert.match(result.temporaryPassword, /^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){3}$/);
  assert.deepEqual(revalidated, ["/teacher"]);
  const state = stored(account);
  assert.equal(state.must_change_password, 1);
  assert.equal(state.session_version, 2);
  assert.equal(state.failed_attempts, 0);
  assert.equal(state.failure_window_started_at, null);
  assert.equal(state.locked_until, null);
  assert(await verifyPassword(result.temporaryPassword, state.password_hash));
  assert.deepEqual(stored(siblingAccount), otherBefore);
  assert.equal((await getTeacherStudentRoster(teacher.id, "class-a"))[0].must_change_password, 1);
  assert.deepEqual(audits().map(row => [row.actor_user_id, row.class_id, row.entity_id, row.details_json]),
    [[teacher.id, "class-a", account.id, "{}"]]);
  assert(!JSON.stringify(fixture.requests).includes(result.temporaryPassword), "the gateway sees only the hash");

  requestSession = signedInStudent(originalUser);
  assert.equal(await getCurrentStudentAccount(), null);
  assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: initialPassword }), null);
  const temporaryUser = await authorizeStudentCredentials({ phone: account.phone, password: result.temporaryPassword });
  assert(temporaryUser);
  requestSession = signedInStudent(temporaryUser);
  assert.deepEqual((await getCurrentStudentAccount()).students, []);
  await assert.rejects(requireStudentAccount(), { code: "PASSWORD_CHANGE_REQUIRED" });
  await changeStudentPassword(account.id, 2, result.temporaryPassword, "New-Only-For-Roster-Fixture");
  assert.equal(await authorizeStudentCredentials({ phone: account.phone, password: result.temporaryPassword }), null);
  assert(await authorizeStudentCredentials({ phone: account.phone, password: "New-Only-For-Roster-Fixture" }));
  assert.equal(stored(account).must_change_password, 0);
});

test("reset denies guests, students and revoked staff, and rejects an invalid confirmation or mismatched selection", async () => {
  const account = seedAccount(1);
  const otherAccount = seedAccount(2);
  const pupil = seedPupil(1, "class-a", account);
  const other = seedPupil(2, "class-b", otherAccount);
  const disabled = seedAccount(3, "SUSPENDED");
  const disabledPupil = seedPupil(3, "class-a", disabled);
  const before = stored(account);
  const otherBefore = stored(otherAccount);
  for (const session of [null, { user: { id: teacher.id, kind: "student" } },
    ...[seedUser("PENDING"), seedUser("TEACHER", { verified: false }), seedUser("SUPER_ADMIN", { status: "SUSPENDED" })].map(user => ({ user: { id: user.id } }))]) {
    requestSession = session;
    assert.equal((await resetStudentPasswordAction(idle, form(pupil, account))).kind, "error");
  }
  requestSession = { user: { id: teacher.id } };
  const duplicate = form(pupil, account);
  duplicate.append("confirmed", "yes");
  for (const input of [
    duplicate, form(pupil, account, { confirmed: undefined }), form(pupil, account, { session_version: 2 }),
    form(pupil, otherAccount), form(pupil, account, { class_id: "class-b" }), form(other, otherAccount), form(disabledPupil, disabled),
  ]) {
    const result = await resetStudentPasswordAction(idle, input);
    assert.equal(result.kind, "error");
    assert.equal(result.temporaryPassword, undefined);
  }
  fixture.database.prepare("UPDATE class_teachers SET ended_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(teacher.id);
  assert.equal((await resetStudentPasswordAction(idle, form(pupil, account))).kind, "error");
  assert.deepEqual(stored(account), before);
  assert.deepEqual(stored(otherAccount), otherBefore);
  assert.equal(stored(disabled).session_version, 1);
  assert.deepEqual(audits(), []);
  assert.deepEqual(revalidated, []);
});

test("a phone linked to other active classes can be reset only by an administrator", async () => {
  const account = seedAccount(1);
  const pupil = seedPupil(1, "class-a", account);
  seedPupil(2, "class-b", account);
  assert.equal((await getTeacherStudentRoster(teacher.id, "class-a"))[0].can_reset, 0);
  assert.equal((await getTeacherStudentRoster(admin.id, "class-a"))[0].can_reset, 1);
  await assert.rejects(resetTeacherStudentPassword(teacher.id, selection(pupil, account)), TeacherStudentError);
  const password = await resetTeacherStudentPassword(admin.id, selection(pupil, account));
  assert(await verifyPassword(password, stored(account).password_hash));
  assert.equal(audits()[0].actor_user_id, admin.id);
});

test("two concurrent requests for the same account revision cannot issue two passwords", async () => {
  const account = seedAccount(1);
  const pupil = seedPupil(1, "class-a", account);
  const input = selection(pupil, account);
  const results = await Promise.allSettled([resetTeacherStudentPassword(admin.id, input), resetTeacherStudentPassword(teacher.id, input)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const winner = results.find(result => result.status === "fulfilled");
  assert(await verifyPassword(winner.value, stored(account).password_hash));
  assert.equal(stored(account).session_version, 2);
  assert.equal(audits().length, 1);
});

test("if the audit write fails, reset rolls back and reveals no password", async () => {
  const account = seedAccount(1);
  const pupil = seedPupil(1, "class-a", account);
  const before = stored(account);
  fixture.database.exec(`CREATE TRIGGER fail_student_reset BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'STUDENT_PASSWORD_RESET' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`);
  requestSession = { user: { id: admin.id } };
  const result = await resetStudentPasswordAction(idle, form(pupil, account));
  assert.deepEqual(Object.keys(result).sort(), ["kind", "message"]);
  assert.equal(result.kind, "error");
  assert.deepEqual(stored(account), before);
  assert.deepEqual(audits(), []);
});
