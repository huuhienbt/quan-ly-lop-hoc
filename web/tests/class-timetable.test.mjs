import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import {
  getStudentTimetablePlan, getTeacherTimetable, saveClassTimetable, toggleTimetableCheck,
} from "../src/lib/class-timetable.ts";
import {
  timetableSchema, timetableWeekday, toggleTimetableCheckSchema,
} from "../src/lib/timetable-schemas.ts";
import { vietnamToday } from "../src/lib/content-schemas.ts";
import { hashPassword } from "../src/lib/password.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

const friday = new Date("2026-10-16T03:00:00.000Z");
const fixturePasswordHash = await hashPassword("Only-For-Timetable-Fixtures-2026!");
// Replace only framework request/cache edges. Authorization and mutations still
// query the actual SQL against the transaction-aware in-memory D1 fixture.
const require = createRequire(import.meta.url);
const nextAuthPath = require.resolve("next-auth");
const realNextAuth = require("next-auth");
const nextCachePath = require.resolve("next/cache");
const realNextCache = require("next/cache");
let requestSession = null;
let revalidations = [];
require.cache[nextAuthPath].exports = { ...realNextAuth, getServerSession: async () => requestSession };
require.cache[nextCachePath].exports = { ...realNextCache, revalidatePath: (...args) => { revalidations.push(args); } };
const { saveTimetableAction } = await import("../src/app/teacher/timetable-actions.ts");
const { updateTimetableCheck } = await import("../src/app/hoc-sinh/timetable-actions.ts");
require.cache[nextAuthPath].exports = realNextAuth;
require.cache[nextCachePath].exports = realNextCache;
let fixture;
let administrator;
let classA;
let classB;

beforeEach((context) => {
  context.mock.timers.enable({ apis: ["Date"], now: friday });
  fixture = createD1Fixture();
  administrator = staff();
  classA = classroom("timetable-class-a");
  classB = classroom("timetable-class-b");
  requestSession = null;
  revalidations = [];
});
afterEach((context) => {
  fixture.restore();
  context.mock.timers.reset();
});

function staff(options = {}) {
  const user = insertUser(fixture.database, { role: "SUPER_ADMIN", ...options });
  if (options.verified !== false) fixture.database.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?")
    .run(friday.toISOString(), user.id);
  return user;
}
function classroom(id) {
  const year = `year-${id}`;
  fixture.database.prepare(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES (?, 'school-ben-tre', ?, '2026-09-01', '2027-05-31')`).run(year, year);
  fixture.database.prepare(`INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
    VALUES (?, 'school-ben-tre', ?, ?, ?, 4, ?)`).run(id, year, id, id, administrator.id);
  return { id, year };
}
function assignedTeacher(classrooms = [classA], options = {}) {
  const user = staff({ role: "TEACHER", ...options });
  for (const { id } of classrooms) fixture.database.prepare(`INSERT INTO class_teachers (class_id, user_id, assigned_by)
    VALUES (?, ?, ?)`).run(id, user.id, administrator.id);
  return user;
}
function family(id = "timetable-family-a", classroom = classA, options = {}) {
  const phone = String(900000000 + fixture.database.prepare("SELECT count(*) AS n FROM student_accounts").get().n).padStart(10, "0");
  fixture.database.prepare(`INSERT INTO student_accounts
    (id, phone, password_hash, must_change_password, status, session_version)
    VALUES (?, ?, ?, ?, ?, 1)`)
    .run(id, phone, fixturePasswordHash, options.must_change_password ?? 0, options.status ?? "ACTIVE");
  const student = `${id}-pupil`, enrollment = `${id}-enrollment`;
  fixture.database.prepare("INSERT INTO students (id, school_id, full_name) VALUES (?, 'school-ben-tre', ?)").run(student, `Synthetic ${student}`);
  fixture.database.prepare("INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)").run(id, student);
  fixture.database.prepare(`INSERT INTO student_enrollments (id, student_id, class_id, school_id, academic_year_id, enrolled_on)
    VALUES (?, ?, ?, 'school-ben-tre', ?, '2026-09-01')`).run(enrollment, student, classroom.id, classroom.year);
  return { id, student, enrollment, version: 1 };
}
function lesson(overrides = {}) {
  return {
    weekday: 1, session: "MORNING", starts_at: "07:20", ends_at: "07:55",
    subject: "Tiếng Việt", instructor: "", todo: "Đọc lại bài hôm nay.",
    preparation: "Chuẩn bị sách Tiếng Việt và vở.", ...overrides,
  };
}
function input(overrides = {}) {
  return { class_id: classA.id, revision: 0, effective_from: "2026-09-28",
    lessons: [lesson(), lesson({ weekday: 5, subject: "Toán", todo: "Ôn lại phép tính.", preparation: "Sách Toán và thước." })],
    ...overrides };
}
function snapshotCounts() {
  return ["class_timetable_settings", "class_timetable_versions", "class_timetable_lessons", "student_timetable_checks"]
    .map((table) => fixture.database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
}
function audits() {
  return fixture.database.prepare("SELECT * FROM audit_logs WHERE action = 'TIMETABLE_SAVED' ORDER BY rowid").all();
}
async function plan(account, date) {
  return getStudentTimetablePlan(account.id, account.version, account.enrollment, date);
}
function check(account, subject, overrides = {}) {
  return { enrollment_id: account.enrollment, lesson_id: subject.lessonId, kind: "PREPARATION",
    lesson_date: "2026-10-19", completed: true, ...overrides };
}
function timetableForm(overrides = {}) {
  const value = input(overrides);
  const data = new FormData();
  for (const [key, field] of Object.entries(value)) data.append(key, key === "lessons" ? JSON.stringify(field) : String(field));
  return data;
}
function checkForm(account, subject, overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(check(account, subject, overrides))) data.append(key, String(value));
  return data;
}
function studentSession(account) {
  return { user: { kind: "student", studentAccountId: account.id, studentSessionVersion: account.version } };
}

test("an empty installation has no fabricated timetable or student tasks", async () => {
  const account = family();
  assert.deepEqual(await getTeacherTimetable(administrator.id, classA.id), { revision: 0, effective_from: "", lessons: [] });
  const result = await plan(account, "2026-10-16");
  assert.equal(result.hasTimetable, false);
  assert.deepEqual(result.todaySubjects, []);
  assert.deepEqual(result.preparationSubjects, []);
  assert.deepEqual(snapshotCounts(), [0, 0, 0, 0]);
});

test("an assigned teacher saves their class and a Super Admin can manage every active class", async () => {
  const teacher = assignedTeacher();
  const saved = await saveClassTimetable(teacher.id, input());
  assert.equal(saved.revision, 1);
  const result = await getTeacherTimetable(teacher.id, classA.id);
  assert.equal(result.revision, 1);
  assert.equal(result.effective_from, "2026-09-28");
  assert.equal(result.lessons.length, 2);
  assert.equal(result.lessons[0].subject, "Tiếng Việt");
  await saveClassTimetable(administrator.id, input({ class_id: classB.id }));
  assert.equal((await getTeacherTimetable(administrator.id, classB.id)).revision, 1);
  assert.equal(audits().length, 2);
  assert.deepEqual(JSON.parse(audits()[0].details_json), { revision: 1, effective_from: "2026-09-28", lesson_count: 2 });
  assert.deepEqual(fixture.database.prepare("PRAGMA foreign_key_check").all(), []);
});

test("unassigned, unverified, pending, suspended and revoked staff cannot read or write a class", async () => {
  const unassigned = assignedTeacher([classB]);
  const unverified = staff({ verified: false });
  const suspended = staff({ status: "SUSPENDED" });
  const revoked = assignedTeacher();
  fixture.database.prepare("UPDATE class_teachers SET ended_at = ? WHERE user_id = ?").run(friday.toISOString(), revoked.id);
  const pending = staff({ role: "PENDING" });
  for (const actor of [unassigned, unverified, suspended, revoked, pending, { id: "missing-user" }]) {
    await assert.rejects(getTeacherTimetable(actor.id, classA.id));
    await assert.rejects(saveClassTimetable(actor.id, input()));
  }
  assert.deepEqual(snapshotCounts(), [0, 0, 0, 0]);
  assert.equal(audits().length, 0);
});

test("revision conflicts leave no orphan lessons, versions or misleading audits", async () => {
  await saveClassTimetable(administrator.id, input());
  const before = snapshotCounts();
  await assert.rejects(saveClassTimetable(administrator.id, input({ lessons: [lesson({ subject: "Stale overwrite" })] })), /tải lại/);
  assert.deepEqual(snapshotCounts(), before);
  assert.equal(audits().length, 1);
  const outcomes = await Promise.allSettled([
    saveClassTimetable(administrator.id, input({ revision: 1, lessons: [lesson({ subject: "Editor A" })] })),
    saveClassTimetable(administrator.id, input({ revision: 1, lessons: [lesson({ subject: "Editor B" })] })),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal((await getTeacherTimetable(administrator.id, classA.id)).revision, 2);
  assert.equal(audits().length, 2);
  assert.deepEqual(snapshotCounts(), [1, 2, 3, 0]);
});

test("an audit failure rolls back settings, snapshot and all inserted lessons together", async () => {
  fixture.database.exec(`CREATE TEMP TRIGGER reject_timetable_audit BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'TIMETABLE_SAVED' BEGIN SELECT RAISE(ABORT, 'intentional isolated timetable audit failure'); END`);
  await assert.rejects(saveClassTimetable(administrator.id, input()));
  assert.deepEqual(snapshotCounts(), [0, 0, 0, 0]);
  assert.equal(audits().length, 0);
});

test("calendar, time, overlap, session and revision errors are rejected before any gateway write", async () => {
  const bad = [
    { effective_from: "2026-02-29" }, { effective_from: "28/09/2026" }, { revision: -1 }, { revision: 1.5 },
    { revision: false }, { revision: null }, { revision: "" }, { actorId: administrator.id },
    { lessons: [lesson({ starts_at: "7:20" })] }, { lessons: [lesson({ ends_at: "07:20" })] },
    { lessons: [lesson({ weekday: 0 })] }, { lessons: [lesson({ session: "AFTERNOON" })] },
    { lessons: [lesson({ subject: "  " })] }, { lessons: [lesson({ ends_at: "24:00" })] },
    { lessons: [lesson(), lesson({ starts_at: "07:30", ends_at: "08:00" })] },
  ];
  for (const overrides of bad) {
    const value = input(overrides);
    assert.equal(timetableSchema.safeParse(value).success, false, JSON.stringify(overrides));
    await assert.rejects(saveClassTimetable(administrator.id, value));
  }
  assert.equal(fixture.requests.length, 0);
  assert.deepEqual(snapshotCounts(), [0, 0, 0, 0]);
});

test("effective dates outside the academic year and archived classes or schools cannot receive schedules", async () => {
  for (const effective_from of ["2026-08-31", "2027-06-01"]) {
    await assert.rejects(saveClassTimetable(administrator.id, input({ effective_from })));
  }
  fixture.database.prepare("UPDATE classes SET archived_at = ? WHERE id = ?").run(friday.toISOString(), classA.id);
  await assert.rejects(saveClassTimetable(administrator.id, input()));
  fixture.database.prepare("UPDATE schools SET archived_at = ? WHERE id = 'school-ben-tre'").run(friday.toISOString());
  await assert.rejects(saveClassTimetable(administrator.id, input({ class_id: classB.id })));
  assert.deepEqual(snapshotCounts(), [0, 0, 0, 0]);
  assert.equal(audits().length, 0);
});

test("a full weekly snapshot stays inside Cloudflare bound-parameter and batch limits", async () => {
  const lessons = Array.from({ length: 63 }, (_, index) => {
    const minutes = 7 * 60 + (index % 9) * 10;
    const at = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
    return lesson({ weekday: Math.floor(index / 9) + 1, starts_at: at(minutes), ends_at: at(minutes + 5) });
  });
  await saveClassTimetable(administrator.id, input({ lessons }));
  assert.equal((await getTeacherTimetable(administrator.id, classA.id)).lessons.length, 63);
  assert.equal(fixture.requests.every(({ params = [] }) => params.length <= 100), true);
  assert.ok(fixture.requests.length < 50);
});

test("Friday and the weekend prepare for Monday while empty days have no invented homework", async (context) => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const result = await plan(account, "2026-10-16");
  assert.equal(result.today, "2026-10-16");
  assert.deepEqual(result.todaySubjects.map(({ subject }) => subject), ["Toán"]);
  assert.equal(result.preparationDate, "2026-10-19");
  assert.deepEqual(result.preparationSubjects.map(({ subject }) => subject), ["Tiếng Việt"]);
  for (const day of ["2026-10-17", "2026-10-18"]) {
    context.mock.timers.setTime(new Date(`${day}T03:00:00Z`).getTime());
    const weekend = await plan(account, day);
    assert.equal(weekend.hasTimetable, true);
    assert.deepEqual(weekend.todaySubjects, []);
    assert.equal(weekend.preparationDate, "2026-10-19");
  }
});

test("repeated periods group into one subject with all times and distinct teacher instructions", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input({ lessons: [
    lesson({ weekday: 5, subject: "Tiếng Việt", todo: "Đọc bài.", preparation: "Sách." }),
    lesson({ weekday: 5, subject: "tiếng việt", starts_at: "08:00", ends_at: "08:35", todo: "Luyện viết.", preparation: "Sách." }),
  ] }));
  const result = await plan(account, "2026-10-16");
  assert.equal(result.todaySubjects.length, 1);
  assert.equal(result.todaySubjects[0].periods.length, 2);
  assert.equal(result.todaySubjects[0].todo, "Đọc bài.\nLuyện viết.");
  assert.equal(result.preparationSubjects[0].preparation, "Sách.");
});

test("a future weekly revision changes only dates from its effective day onward", async () => {
  const account = family();
  const first = await saveClassTimetable(administrator.id, input());
  const second = await saveClassTimetable(administrator.id, input({ revision: first.revision,
    effective_from: "2026-10-19", lessons: [lesson({ subject: "Khoa học", preparation: "Mang sách Khoa học." })] }));
  assert.equal(second.revision, 2);
  const fridayPlan = await plan(account, "2026-10-16");
  assert.equal(fridayPlan.effectiveFrom, "2026-09-28");
  assert.deepEqual(fridayPlan.todaySubjects.map(({ subject }) => subject), ["Toán"]);
  assert.deepEqual(fridayPlan.preparationSubjects.map(({ subject }) => subject), ["Khoa học"]);
  const monday = await plan(account, "2026-10-19");
  assert.equal(monday.effectiveFrom, "2026-10-19");
  assert.deepEqual(monday.todaySubjects.map(({ subject }) => subject), ["Khoa học"]);
});

test("no timetable or preparation leaks beyond the academic year's end", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const lastDay = await plan(account, "2027-05-31");
  assert.equal(lastDay.todaySubjects.length, 1);
  assert.equal(lastDay.preparationDate, null);
  assert.deepEqual(lastDay.preparationSubjects, []);
  const ended = await plan(account, "2027-06-01");
  assert.equal(ended.hasTimetable, false);
  assert.deepEqual(ended.todaySubjects, []);
  assert.deepEqual(ended.preparationSubjects, []);
});

test("empty new snapshots intentionally remove future lessons without modifying historical versions", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  await saveClassTimetable(administrator.id, input({ revision: 1, effective_from: "2026-10-19", lessons: [] }));
  const before = await plan(account, "2026-10-16");
  assert.equal(before.todaySubjects.length, 1);
  assert.equal(before.preparationDate, null);
  const cleared = await plan(account, "2026-10-19");
  assert.equal(cleared.hasTimetable, true);
  assert.deepEqual(cleared.todaySubjects, []);
  assert.equal((await getTeacherTimetable(administrator.id, classA.id)).lessons.length, 0);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_timetable_lessons").get().n, 2);
});

test("student plans require a live linked enrollment, changed password and current session version", async () => {
  const account = family();
  const other = family("timetable-family-b", classB);
  await saveClassTimetable(administrator.id, input());
  assert.equal((await plan(account, "2026-10-16")).hasTimetable, true);
  for (const [accountId, version, enrollment] of [
    [account.id, 2, account.enrollment], [other.id, 1, account.enrollment],
    [account.id, 1, other.enrollment], ["missing", 1, account.enrollment],
  ]) assert.equal((await getStudentTimetablePlan(accountId, version, enrollment, "2026-10-16")).hasTimetable, false);
  fixture.database.prepare("UPDATE student_accounts SET must_change_password = 1 WHERE id = ?").run(account.id);
  assert.equal((await plan(account, "2026-10-16")).hasTimetable, false);
  fixture.database.prepare("UPDATE student_accounts SET must_change_password = 0, status = 'SUSPENDED' WHERE id = ?").run(account.id);
  assert.equal((await plan(account, "2026-10-16")).hasTimetable, false);
});

test("completing Monday preparation on Friday persists through the weekend for that pupil only", async (context) => {
  const account = family(), sibling = family("timetable-family-b");
  await saveClassTimetable(administrator.id, input());
  const subject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  await toggleTimetableCheck(account.id, 1, check(account, subject));
  await toggleTimetableCheck(account.id, 1, check(account, subject));
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_timetable_checks").get().n, 1);
  assert.equal((await plan(account, "2026-10-16")).preparationSubjects[0].completed, true);
  assert.equal((await plan(sibling, "2026-10-16")).preparationSubjects[0].completed, false);
  context.mock.timers.setTime(new Date("2026-10-18T03:00:00Z").getTime());
  assert.equal((await plan(account, "2026-10-18")).preparationSubjects[0].completed, true);
  await toggleTimetableCheck(account.id, 1, check(account, subject, { completed: false }));
  await toggleTimetableCheck(account.id, 1, check(account, subject, { completed: false }));
  assert.equal((await plan(account, "2026-10-18")).preparationSubjects[0].completed, false);
});

test("today completion is independent from preparation and from a later week's same subject", async (context) => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const fridayPlan = await plan(account, "2026-10-16");
  await toggleTimetableCheck(account.id, 1, check(account, fridayPlan.todaySubjects[0], { kind: "TODO", lesson_date: "2026-10-16" }));
  assert.equal((await plan(account, "2026-10-16")).todaySubjects[0].completed, true);
  assert.equal((await plan(account, "2026-10-16")).preparationSubjects[0].completed, false);
  context.mock.timers.setTime(new Date("2026-10-23T03:00:00Z").getTime());
  assert.equal((await plan(account, "2026-10-23")).todaySubjects[0].completed, false);
});

test("forged class lessons, pupils, nonrepresentative periods and dates cannot write progress", async () => {
  const account = family(), other = family("timetable-family-b", classB);
  await saveClassTimetable(administrator.id, input({ lessons: [lesson(), lesson({ starts_at: "08:00", ends_at: "08:35" })] }));
  await saveClassTimetable(administrator.id, input({ class_id: classB.id }));
  const subject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  const otherSubject = (await plan(other, "2026-10-16")).preparationSubjects[0];
  const second = fixture.database.prepare("SELECT id FROM class_timetable_lessons WHERE class_id = ? AND starts_at = '08:00'").get(classA.id).id;
  for (const overrides of [
    { lesson_id: otherSubject.lessonId }, { enrollment_id: other.enrollment }, { lesson_id: second },
    { lesson_date: "2026-10-20" }, { lesson_date: "2026-10-26" }, { kind: "TODO", lesson_date: "2026-10-16" },
  ]) await assert.rejects(toggleTimetableCheck(account.id, 1, check(account, subject, overrides)));
  await assert.rejects(toggleTimetableCheck(other.id, 1, check(account, subject)));
  await assert.rejects(toggleTimetableCheck(account.id, 2, check(account, subject)));
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_timetable_checks").get().n, 0);
});

test("new teacher revisions invalidate old lesson checkboxes and retain earlier completion history", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const oldSubject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  await toggleTimetableCheck(account.id, 1, check(account, oldSubject));
  await saveClassTimetable(administrator.id, input({ revision: 1, effective_from: "2026-10-16" }));
  await assert.rejects(toggleTimetableCheck(account.id, 1, check(account, oldSubject)));
  const current = await plan(account, "2026-10-16");
  assert.notEqual(current.preparationSubjects[0].lessonId, oldSubject.lessonId);
  assert.equal(current.preparationSubjects[0].completed, false);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_timetable_checks").get().n, 1);
});

test("revoking account access between reading a plan and writing a checkbox is enforced inside the batch", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const subject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  const originalFetch = globalThis.fetch;
  let revoked = false;
  globalThis.fetch = async (url, options) => {
    const response = await originalFetch(url, options);
    const payload = JSON.parse(options.body);
    if (!revoked && !Array.isArray(payload) && payload.sql.includes("todo_completed")) {
      revoked = true;
      fixture.database.prepare("UPDATE student_accounts SET session_version = session_version + 1 WHERE id = ?").run(account.id);
    }
    return response;
  };
  await assert.rejects(toggleTimetableCheck(account.id, 1, check(account, subject)));
  assert.equal(revoked, true);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_timetable_checks").get().n, 0);
});

test("a timetable changed after the plan read cannot receive an old checkbox in the atomic write", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const subject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  const originalFetch = globalThis.fetch;
  let changed = false;
  globalThis.fetch = async (url, options) => {
    const response = await originalFetch(url, options);
    const payload = JSON.parse(options.body);
    if (!changed && !Array.isArray(payload) && payload.sql.includes("todo_completed")) {
      changed = true;
      await saveClassTimetable(administrator.id, input({ revision: 1, effective_from: "2026-10-16",
        lessons: [lesson({ weekday: 7, subject: "Hoạt động bổ sung" }), lesson()] }));
    }
    return response;
  };
  await assert.rejects(toggleTimetableCheck(account.id, 1, check(account, subject)));
  assert.equal(changed, true);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_timetable_checks").get().n, 0);
  assert.equal((await plan(account, "2026-10-16")).preparationDate, "2026-10-18");
});

test("archived pupils/classes/schools and ended enrollment lose plan and checkbox access", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const subject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  const updates = [
    ["UPDATE students SET archived_at = ? WHERE id = ?", "UPDATE students SET archived_at = NULL WHERE id = ?", account.student],
    ["UPDATE classes SET archived_at = ? WHERE id = ?", "UPDATE classes SET archived_at = NULL WHERE id = ?", classA.id],
    ["UPDATE schools SET archived_at = ? WHERE id = ?", "UPDATE schools SET archived_at = NULL WHERE id = ?", "school-ben-tre"],
  ];
  for (const [revoke, restore, id] of updates) {
    fixture.database.prepare(revoke).run(friday.toISOString(), id);
    assert.equal((await plan(account, "2026-10-16")).hasTimetable, false);
    await assert.rejects(toggleTimetableCheck(account.id, 1, check(account, subject)));
    fixture.database.prepare(restore).run(id);
  }
  fixture.database.prepare("UPDATE student_enrollments SET status = 'TRANSFERRED', ended_on = '2026-10-16' WHERE id = ?").run(account.enrollment);
  assert.equal((await plan(account, "2026-10-16")).hasTimetable, false);
  await assert.rejects(toggleTimetableCheck(account.id, 1, check(account, subject)));
});

test("Vietnam midnight determines the teaching weekday and strict checkbox form values", () => {
  assert.equal(vietnamToday(new Date("2026-10-18T16:59:59.999Z")), "2026-10-18");
  assert.equal(vietnamToday(new Date("2026-10-18T17:00:00.000Z")), "2026-10-19");
  assert.equal(timetableWeekday("2026-10-18"), 7);
  assert.equal(timetableWeekday("2026-10-19"), 1);
  const valid = { enrollment_id: "fixture-enrollment", lesson_id: "fixture-lesson", kind: "TODO", lesson_date: "2026-10-16", completed: "false" };
  assert.equal(toggleTimetableCheckSchema.parse(valid).completed, false);
  for (const overrides of [{ completed: "0" }, { completed: "yes" }, { completed: 0 }, { kind: "HOMEWORK" }, { lesson_date: "2026-02-29" }, { user_id: "forged" }]) {
    assert.equal(toggleTimetableCheckSchema.safeParse({ ...valid, ...overrides }).success, false);
  }
});

test("the teacher action uses current staff identity and rejects anonymous or forged student sessions", async () => {
  const pending = staff({ role: "PENDING" });
  const unverified = staff({ verified: false });
  const suspended = staff({ status: "SUSPENDED" });
  for (const user of [null, pending, unverified, suspended]) {
    requestSession = user ? { user: { id: user.id, role: "SUPER_ADMIN" } } : null;
    assert.equal((await saveTimetableAction({ success: false, message: "" }, timetableForm())).success, false);
  }
  requestSession = { user: { id: administrator.id, kind: "student", role: "SUPER_ADMIN" } };
  assert.equal((await saveTimetableAction({ success: false, message: "" }, timetableForm())).success, false);
  assert.deepEqual(snapshotCounts(), [0, 0, 0, 0]);
  assert.deepEqual(revalidations, []);
});

test("the teacher action rejects duplicate, unknown, malformed and oversized lesson form fields", async () => {
  requestSession = { user: { id: administrator.id } };
  const duplicate = timetableForm(); duplicate.append("class_id", classB.id);
  const unknown = timetableForm(); unknown.append("actor_id", administrator.id);
  const malformed = timetableForm(); malformed.set("lessons", "[{broken JSON");
  const oversized = timetableForm(); oversized.set("lessons", " ".repeat(200001));
  const wrongFieldType = timetableForm(); wrongFieldType.set("lessons", new Blob(["[]"], { type: "application/json" }), "lessons.json");
  for (const form of [duplicate, unknown, malformed, oversized, wrongFieldType]) {
    assert.equal((await saveTimetableAction({ success: false, message: "" }, form)).success, false);
  }
  assert.deepEqual(snapshotCounts(), [0, 0, 0, 0]);
  assert.deepEqual(revalidations, []);
});

test("the teacher action acknowledges only committed changes and keeps internal SQL failures private", async () => {
  requestSession = { user: { id: administrator.id } };
  const form = timetableForm(); form.append("$ACTION_ID_fixture", "framework-only");
  const result = await saveTimetableAction({ success: false, message: "" }, form);
  assert.equal(result.success, true);
  assert.deepEqual(revalidations, [["/teacher"], ["/hoc-sinh"]]);
  const stale = await saveTimetableAction({ success: true, message: result.message }, timetableForm());
  assert.equal(stale.success, false);
  assert.match(stale.message, /tải lại/);
  fixture.database.exec(`CREATE TEMP TRIGGER reject_timetable_action_audit BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'TIMETABLE_SAVED' BEGIN SELECT RAISE(ABORT, 'PRIVATE_TIMETABLE_SQL_DETAIL'); END`);
  const failed = await saveTimetableAction({ success: true, message: result.message }, timetableForm({ revision: 1 }));
  assert.equal(failed.success, false);
  assert.equal(failed.message.includes("PRIVATE_TIMETABLE_SQL_DETAIL"), false);
  assert.equal((await getTeacherTimetable(administrator.id, classA.id)).revision, 1);
  assert.equal(audits().length, 1);
  assert.deepEqual(revalidations, [["/teacher"], ["/hoc-sinh"]]);
});

test("the student action binds progress to its authenticated account and preserves confirmed state on errors", async () => {
  const account = family(), other = family("timetable-family-b", classB);
  await saveClassTimetable(administrator.id, input());
  const subject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  for (const session of [null, { user: { id: administrator.id, role: "SUPER_ADMIN" } }, studentSession(other)]) {
    requestSession = session;
    const failed = await updateTimetableCheck({ success: true, message: "old", completed: true }, checkForm(account, subject));
    assert.equal(failed.success, false);
    assert.equal(failed.completed, true);
  }
  requestSession = studentSession(account);
  const duplicate = checkForm(account, subject); duplicate.append("enrollment_id", other.enrollment);
  const unknown = checkForm(account, subject); unknown.append("studentAccountId", other.id);
  const incorrectDate = checkForm(account, subject, { lesson_date: "2026-10-26" });
  for (const form of [duplicate, unknown, incorrectDate]) {
    const failed = await updateTimetableCheck({ success: false, message: "", completed: false }, form);
    assert.equal(failed.success, false);
    assert.equal(failed.completed, false);
  }
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_timetable_checks").get().n, 0);
  assert.deepEqual(revalidations, []);
});

test("the student action returns the confirmed saved checkbox and supports clearing it", async () => {
  const account = family();
  await saveClassTimetable(administrator.id, input());
  const subject = (await plan(account, "2026-10-16")).preparationSubjects[0];
  requestSession = studentSession(account);
  const selected = await updateTimetableCheck({ success: false, message: "", completed: false }, checkForm(account, subject));
  assert.equal(selected.success, true);
  assert.equal(selected.completed, true);
  assert.equal((await plan(account, "2026-10-16")).preparationSubjects[0].completed, true);
  const cleared = await updateTimetableCheck(selected, checkForm(account, subject, { completed: false }));
  assert.equal(cleared.success, true);
  assert.equal(cleared.completed, false);
  assert.equal((await plan(account, "2026-10-16")).preparationSubjects[0].completed, false);
  assert.deepEqual(revalidations, [["/hoc-sinh"], ["/hoc-sinh"]]);
});
