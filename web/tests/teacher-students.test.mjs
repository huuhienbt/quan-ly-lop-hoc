import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
import { authorizeStudentCredentials, changeStudentPassword } from "../src/lib/student-credentials.ts";
import { getTeacherStudentRoster, resetTeacherStudentPassword, resetTeacherStudentPasswords, TeacherStudentError } from "../src/lib/teacher-students.ts";
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
const { resetStudentPasswordAction, resetStudentPasswordsAction } = await import("../src/app/teacher/student-actions.ts");
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
  const phone = "090" + String(n).padStart(7, "0");
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

function bulkSelection(pupil, account) {
  return { enrollment_id: pupil.enrollment, account_id: account.id, session_version: 1 };
}

function bulkForm(classId, targets, confirmed = "yes") {
  const data = new FormData();
  data.set("class_id", classId);
  data.set("targets", JSON.stringify(targets));
  if (confirmed) data.set("confirmed", confirmed);
  return data;
}

function bulkAudits() {
  return fixture.database.prepare("SELECT * FROM audit_logs WHERE action = 'STUDENT_PASSWORD_BULK_RESET'").all();
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

test("a full class can receive distinct eight-digit temporary passwords in one documented transaction", async context => {
  const issued = new Date("2026-11-23T03:15:00.000Z");
  context.mock.timers.enable({ apis: ["Date"], now: issued });
  const targets = Array.from({ length: 42 }, (_, i) => {
    const account = seedAccount(i + 1);
    return { account, pupil: seedPupil(i + 1, "class-a", account) };
  });
  const sibling = seedPupil(43, "class-a", targets[0].account);
  const untouched = seedAccount(44);
  seedPupil(44, "class-a", untouched);
  const untouchedBefore = stored(untouched);
  requestSession = { user: { id: teacher.id } };
  const result = await resetStudentPasswordsAction(idle, bulkForm("class-a", targets.map(({ pupil, account }) => bulkSelection(pupil, account))));
  assert.equal(result.kind, "success");
  assert.equal(result.expiresAt, "2026-11-24T03:15:00.000Z");
  assert.deepEqual(revalidated, ["/teacher"]);
  assert.equal(result.accounts.length, 42);
  assert.equal(new Set(result.accounts.map(row => row.temporaryPassword)).size, 42);
  assert.deepEqual(result.accounts[0].names, [targets[0].pupil.name, sibling.name]);
  assert.equal(result.accounts[0].phone, targets[0].account.phone);
  for (const [index, entry] of result.accounts.entries()) {
    assert.match(entry.temporaryPassword, /^[0-9]{8}$/);
    assert.notEqual(entry.temporaryPassword, "12345678");
    const account = stored(targets[index].account);
    assert.equal(account.must_change_password, 1);
    assert.equal(account.session_version, 2);
    assert.equal(account.temporary_password_expires_at, result.expiresAt);
  }
  for (const index of [0, 41]) {
    assert(await verifyPassword(result.accounts[index].temporaryPassword, stored(targets[index].account).password_hash));
  }
  assert.equal(bulkAudits().length, 42);
  assert(bulkAudits().every(row => row.actor_user_id === teacher.id && row.class_id === "class-a" &&
    row.details_json === JSON.stringify({ expires_at: result.expiresAt })));
  const write = fixture.requests.find(({ sql }) => sql.includes("WITH requested AS"));
  assert.equal(JSON.parse(write.params[0]).length, 42);
  assert(!JSON.parse(write.params[0]).some((entry, i) => Object.values(entry).includes(result.accounts[i].temporaryPassword)));
  assert.deepEqual(stored(untouched), untouchedBefore);
});

test("eight-digit temporary passwords expire with their restricted sessions and are revoked after changing them", async context => {
  const initialTime = new Date("2026-11-23T03:15:00.000Z");
  context.mock.timers.enable({ apis: ["Date"], now: initialTime });
  const first = seedAccount(1);
  const second = seedAccount(2);
  const firstPupil = seedPupil(1, "class-a", first);
  const secondPupil = seedPupil(2, "class-a", second);
  const oldSession = await authorizeStudentCredentials({ phone: first.phone, password: initialPassword });
  const receipt = await resetTeacherStudentPasswords(admin.id, "class-a", [bulkSelection(firstPupil, first), bulkSelection(secondPupil, second)]);
  const [firstCode, secondCode] = receipt.accounts.map(row => row.temporaryPassword);
  requestSession = signedInStudent(oldSession);
  assert.equal(await getCurrentStudentAccount(), null);
  assert.equal(await authorizeStudentCredentials({ phone: first.phone, password: initialPassword }), null);
  const firstTemp = await authorizeStudentCredentials({ phone: first.phone, password: firstCode });
  assert(firstTemp);
  requestSession = signedInStudent(firstTemp);
  await assert.rejects(requireStudentAccount(), { code: "PASSWORD_CHANGE_REQUIRED" });
  assert.deepEqual((await requireStudentAccount({ allowPasswordChange: true })).students, []);
  await changeStudentPassword(first.id, 2, firstCode, "Different-Only-For-Roster-Fixture!");
  assert.equal(stored(first).temporary_password_expires_at, null);
  assert.equal(await authorizeStudentCredentials({ phone: first.phone, password: firstCode }), null);
  assert(await authorizeStudentCredentials({ phone: first.phone, password: "Different-Only-For-Roster-Fixture!" }));

  const expiry = Date.parse(receipt.expiresAt);
  context.mock.timers.setTime(expiry - 1);
  const secondTemp = await authorizeStudentCredentials({ phone: second.phone, password: secondCode });
  assert(secondTemp, "the code is still valid just before the deadline");
  requestSession = signedInStudent(secondTemp);
  assert(await getCurrentStudentAccount());
  context.mock.timers.setTime(expiry);
  assert.equal(await getCurrentStudentAccount(), null);
  assert.equal(await authorizeStudentCredentials({ phone: second.phone, password: secondCode }), null);
  await assert.rejects(changeStudentPassword(second.id, 2, secondCode, "Different-Only-For-Roster-Fixture!"));
  assert.equal((await getTeacherStudentRoster(teacher.id, "class-a"))[1].temporary_password_expired, 1);
  const individual = await resetTeacherStudentPassword(teacher.id, { ...selection(secondPupil, second), session_version: 2 });
  assert.equal(stored(second).temporary_password_expires_at, null);
  assert(await authorizeStudentCredentials({ phone: second.phone, password: individual }));
});

test("bulk reset refuses omitted confirmation, guests, duplicates, and out-of-scope accounts without touching selected accounts", async () => {
  const account = seedAccount(1);
  const outside = seedAccount(2);
  const shared = seedAccount(3);
  const a = bulkSelection(seedPupil(1, "class-a", account), account);
  const b = bulkSelection(seedPupil(2, "class-b", outside), outside);
  const sharedA = bulkSelection(seedPupil(3, "class-a", shared), shared);
  seedPupil(4, "class-b", shared);
  assert.equal((await resetStudentPasswordsAction(idle, bulkForm("class-a", [a]))).kind, "error");
  requestSession = { user: { id: teacher.id } };
  for (const input of [
    bulkForm("class-a", [a], ""), bulkForm("class-a", [a, a]),
    bulkForm("class-a", [a, b]), bulkForm("class-a", [a, sharedA]),
    bulkForm("class-a", [a, { ...a, account_id: outside.id }]),
  ]) {
    const result = await resetStudentPasswordsAction(idle, input);
    assert.equal(result.kind, "error");
    assert.equal(result.accounts, undefined);
  }
  assert([account, outside, shared].every(row => stored(row).session_version === 1));
  assert.deepEqual(bulkAudits(), []);
});

test("a changed account between preview and write prevents all of the batch updates", async () => {
  const first = seedAccount(1);
  const second = seedAccount(2);
  const a = bulkSelection(seedPupil(1, "class-a", first), first);
  const b = bulkSelection(seedPupil(2, "class-a", second), second);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.body.includes("WITH requested AS")) {
      fixture.database.prepare("UPDATE student_accounts SET session_version = 2 WHERE id = ?").run(second.id);
    }
    return originalFetch(url, options);
  };
  await assert.rejects(resetTeacherStudentPasswords(teacher.id, "class-a", [a, b]), TeacherStudentError);
  assert.equal(stored(first).session_version, 1);
  assert.equal(stored(first).password_hash, initialHash);
  assert.equal(stored(second).password_hash, initialHash);
  assert.deepEqual(bulkAudits(), []);
});

test("bulk reset rolls back every account when writing the audit cannot complete", async () => {
  const first = seedAccount(1);
  const second = seedAccount(2);
  const a = bulkSelection(seedPupil(1, "class-a", first), first);
  const b = bulkSelection(seedPupil(2, "class-a", second), second);
  fixture.database.exec(`CREATE TRIGGER fail_bulk_reset_audit BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'STUDENT_PASSWORD_BULK_RESET' AND NEW.entity_id = '${second.id}'
    BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`);
  requestSession = { user: { id: admin.id } };
  const result = await resetStudentPasswordsAction(idle, bulkForm("class-a", [a, b]));
  assert.equal(result.kind, "error");
  assert.equal(result.accounts, undefined);
  assert([first, second].every(row => stored(row).session_version === 1 && stored(row).password_hash === initialHash));
  assert.deepEqual(bulkAudits(), []);
});
