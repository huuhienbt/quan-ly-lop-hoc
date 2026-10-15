import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  archiveContent,
  getPublicBulletin,
  getPublicPost,
  getStudentClassContent,
  getTeacherContentOverview,
  saveEvent,
  savePost,
  saveTask,
  toggleStudentTask,
} from "../src/lib/class-content.ts";
import {
  addDays, eventSchema, getVietnamDateWindow, postSchema,
  taskSchema, toggleTaskSchema, vietnamToday,
} from "../src/lib/content-schemas.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";
import { hashPassword } from "../src/lib/password.ts";

const fixedTime = new Date("2026-10-14T17:30:00.000Z");
const fixturePasswordHash = await hashPassword("Only-For-Content-Fixtures-2026!");
let fixture;
let administrator;
let classA;
let classB;

beforeEach((context) => {
  context.mock.timers.enable({ apis: ["Date"], now: fixedTime });
  fixture = createD1Fixture();
  administrator = seedStaff();
  classA = seedClass("class-test-a");
  classB = seedClass("class-test-b");
});
afterEach((context) => {
  fixture.restore();
  context.mock.timers.reset();
});

function seedStaff(options = {}) {
  const user = insertUser(fixture.database, { role: "SUPER_ADMIN", ...options });
  if (options.verified !== false) {
    fixture.database.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(fixedTime.toISOString(), user.id);
  }
  return user;
}

function seedClass(id, options = {}) {
  const schoolId = options.school_id ?? "school-ben-tre";
  const yearId = `year-${id}`;
  fixture.database.prepare(`INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
    VALUES (?, ?, ?, '2026-09-01', '2027-05-31')`).run(yearId, schoolId, yearId);
  fixture.database.prepare(`INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
    VALUES (?, ?, ?, ?, ?, 4, ?)`).run(id, schoolId, yearId, `Lớp giả lập ${id}`, id, administrator.id);
  return { id, school_id: schoolId, academic_year_id: yearId };
}

function seedFamily(id, classrooms, options = {}) {
  const number = id === "family-test-a" ? "1" : "2";
  fixture.database.prepare(`INSERT INTO student_accounts
    (id, phone, password_hash, must_change_password, status, session_version)
    VALUES (?, ?, ?, ?, ?, 1)`)
    .run(id, `090000000${number}`, fixturePasswordHash, options.must_change_password ?? 0, options.status ?? "ACTIVE");
  const pupils = classrooms.map((classroom, index) => {
    const studentId = `${id}-child-${index}`;
    const enrollmentId = `${id}-enrollment-${index}`;
    fixture.database.prepare("INSERT INTO students (id, school_id, full_name) VALUES (?, ?, ?)")
      .run(studentId, classroom.school_id, `Học sinh giả lập ${studentId}`);
    fixture.database.prepare("INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)").run(id, studentId);
    fixture.database.prepare(`INSERT INTO student_enrollments
      (id, student_id, class_id, school_id, academic_year_id, enrolled_on)
      VALUES (?, ?, ?, ?, ?, '2026-09-01')`)
      .run(enrollmentId, studentId, classroom.id, classroom.school_id, classroom.academic_year_id);
    return { student_id: studentId, enrollment_id: enrollmentId, class_id: classroom.id };
  });
  return { id, version: 1, pupils };
}

function postInput(classId = classA.id, overrides = {}) {
  return {
    class_id: classId,
    title: "Bản tin giả lập",
    body: "Cùng nhau học tập vui vẻ.",
    kind: "NEWS",
    category: "GENERAL",
    cover_url: "",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    is_pinned: false,
    ...overrides,
  };
}

function eventInput(classId = classA.id, overrides = {}) {
  return {
    class_id: classId,
    title: "Sự kiện giả lập",
    body: "Cùng tham gia hoạt động lớp.",
    event_date: "2026-10-15",
    starts_at: "08:00",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    ...overrides,
  };
}

function taskInput(classId = classA.id, overrides = {}) {
  return {
    class_id: classId,
    title: "Nhiệm vụ giả lập",
    details: "Chuẩn bị dụng cụ học tập.",
    kind: "TODO",
    task_date: null,
    sort_order: 0,
    ...overrides,
  };
}

function seedAssignedTeacher(classrooms = [classA], options = {}) {
  const teacher = seedStaff({ role: "TEACHER", ...options });
  for (const classroom of classrooms) {
    fixture.database.prepare("INSERT INTO class_teachers (class_id, user_id, assigned_by) VALUES (?, ?, ?)")
      .run(classroom.id, teacher.id, administrator.id);
  }
  return teacher;
}

test("Vietnam dates switch at UTC 17:00 and weeks always run Monday through Sunday", () => {
  const beforeMidnight = new Date("2026-10-11T16:59:59.999Z");
  const afterMidnight = new Date("2026-10-11T17:00:00.000Z");
  assert.equal(vietnamToday(beforeMidnight), "2026-10-11");
  assert.equal(vietnamToday(afterMidnight), "2026-10-12");
  const sunday = getVietnamDateWindow(beforeMidnight);
  assert.equal(sunday.weekStart, "2026-10-05");
  assert.equal(sunday.weekEnd, "2026-10-11");
  const monday = getVietnamDateWindow(afterMidnight);
  assert.equal(monday.weekStart, "2026-10-12");
  assert.equal(monday.weekEnd, "2026-10-18");
  assert.equal(monday.tomorrow, "2026-10-13");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("public bulletin and direct post lookup expose only explicitly public published content", async () => {
  const publicPost = await savePost(administrator.id, postInput(classA.id, { title: "Bài công khai" }));
  const privatePost = await savePost(administrator.id, postInput(classA.id, { title: "PRIVATE_SENTINEL", visibility: "PRIVATE" }));
  const draft = await savePost(administrator.id, postInput(classA.id, { title: "DRAFT_SENTINEL", status: "DRAFT" }));
  const publicEvent = await saveEvent(administrator.id, eventInput(classA.id, { title: "Sự kiện công khai" }));
  await saveEvent(administrator.id, eventInput(classA.id, { title: "PRIVATE_EVENT_SENTINEL", visibility: "PRIVATE" }));
  await saveEvent(administrator.id, eventInput(classA.id, { title: "DRAFT_EVENT_SENTINEL", status: "DRAFT" }));
  seedFamily("family-test-a", [classA]);
  const bulletin = await getPublicBulletin();
  assert.deepEqual(bulletin.posts.map((post) => post.id), [publicPost]);
  assert.deepEqual(bulletin.events.map((event) => event.id), [publicEvent]);
  assert.equal((await getPublicPost(publicPost)).id, publicPost);
  assert.equal(await getPublicPost(privatePost), null);
  assert.equal(await getPublicPost(draft), null);
  assert.equal(await getPublicPost("nonexistent-post"), null);
  const serialized = JSON.stringify(bulletin);
  for (const sensitive of ["PRIVATE_SENTINEL", "DRAFT_SENTINEL", "PRIVATE_EVENT_SENTINEL", "DRAFT_EVENT_SENTINEL", "0900000001", "Học sinh giả lập"]) {
    assert.equal(serialized.includes(sensitive), false);
  }
});

test("public event windows include Monday and Sunday and exclude surrounding weeks", async () => {
  const dates = ["2026-10-11", "2026-10-12", "2026-10-18", "2026-10-19"];
  const ids = [];
  for (const event_date of dates) ids.push(await saveEvent(administrator.id, eventInput(classA.id, { event_date, title: event_date })));
  const bulletin = await getPublicBulletin();
  assert.deepEqual(bulletin.events.map((event) => event.id).sort(), [ids[1], ids[2]].sort());
  assert.equal(bulletin.today, "2026-10-15");
  assert.equal(bulletin.weekStart, "2026-10-12");
  assert.equal(bulletin.weekEnd, "2026-10-18");
});

test("archiving a class or its school removes its content from public reads", async () => {
  const first = await savePost(administrator.id, postInput(classA.id));
  await savePost(administrator.id, postInput(classB.id));
  await saveEvent(administrator.id, eventInput(classA.id));
  fixture.database.prepare("UPDATE classes SET archived_at = ? WHERE id = ?").run(fixedTime.toISOString(), classA.id);
  assert.equal(await getPublicPost(first), null);
  assert.equal((await getPublicBulletin()).posts.length, 1);
  assert.equal((await getPublicBulletin()).events.length, 0);
  fixture.database.prepare("UPDATE schools SET archived_at = ? WHERE id = 'school-ben-tre'").run(fixedTime.toISOString());
  const bulletin = await getPublicBulletin();
  assert.deepEqual(bulletin.posts, []);
  assert.deepEqual(bulletin.events, []);
});

test("student feeds include published class-private content while excluding drafts and another family's class", async () => {
  const family = seedFamily("family-test-a", [classA]);
  seedFamily("family-test-b", [classB]);
  const ownPrivate = await savePost(administrator.id, postInput(classA.id, { visibility: "PRIVATE" }));
  const ownPublic = await savePost(administrator.id, postInput(classA.id));
  await savePost(administrator.id, postInput(classA.id, { status: "DRAFT", title: "OWN_DRAFT_SENTINEL" }));
  await savePost(administrator.id, postInput(classB.id, { title: "OTHER_CLASS_SENTINEL" }));
  const ownEvent = await saveEvent(administrator.id, eventInput(classA.id, { visibility: "PRIVATE" }));
  await saveEvent(administrator.id, eventInput(classB.id, { title: "OTHER_EVENT_SENTINEL" }));
  const feed = await getStudentClassContent(family.id, family.version);
  assert.equal(feed.students.length, 1);
  assert.equal(feed.students[0].student_id, family.pupils[0].student_id);
  assert.deepEqual(feed.students[0].posts.map((post) => post.id).sort(), [ownPrivate, ownPublic].sort());
  assert.deepEqual(feed.students[0].events.map((event) => event.id), [ownEvent]);
  for (const hidden of ["OWN_DRAFT_SENTINEL", "OTHER_CLASS_SENTINEL", "OTHER_EVENT_SENTINEL", "family-test-b-child"]) {
    assert.equal(JSON.stringify(feed).includes(hidden), false);
  }
});

test("student content checks the current account status, session version and mandatory password flag", async () => {
  const family = seedFamily("family-test-a", [classA]);
  await savePost(administrator.id, postInput(classA.id));
  assert.equal((await getStudentClassContent(family.id, 1)).students.length, 1);
  assert.deepEqual((await getStudentClassContent(family.id, 2)).students, []);
  assert.deepEqual((await getStudentClassContent("unknown-account", 1)).students, []);
  fixture.database.prepare("UPDATE student_accounts SET must_change_password = 1 WHERE id = ?").run(family.id);
  assert.deepEqual((await getStudentClassContent(family.id, 1)).students, []);
  fixture.database.prepare("UPDATE student_accounts SET must_change_password = 0, status = 'SUSPENDED' WHERE id = ?").run(family.id);
  assert.deepEqual((await getStudentClassContent(family.id, 1)).students, []);
});

test("archived pupils and ended enrollment cannot keep reading an old class feed", async () => {
  const family = seedFamily("family-test-a", [classA, classB]);
  fixture.database.prepare("UPDATE students SET archived_at = ? WHERE id = ?").run(fixedTime.toISOString(), family.pupils[0].student_id);
  let content = await getStudentClassContent(family.id, 1);
  assert.deepEqual(content.students.map((student) => student.student_id), [family.pupils[1].student_id]);
  fixture.database.prepare("UPDATE student_enrollments SET status = 'TRANSFERRED', ended_on = '2026-10-15' WHERE id = ?")
    .run(family.pupils[1].enrollment_id);
  content = await getStudentClassContent(family.id, 1);
  assert.deepEqual(content.students, []);
});

test("archived classes and schools block student reads, progress writes and staff editing", async () => {
  const family = seedFamily("family-test-a", [classA, classB]);
  const taskA = await saveTask(administrator.id, taskInput(classA.id));
  const taskB = await saveTask(administrator.id, taskInput(classB.id));
  fixture.database.prepare("UPDATE classes SET archived_at = ? WHERE id = ?").run(fixedTime.toISOString(), classA.id);
  assert.deepEqual((await getStudentClassContent(family.id, 1)).students.map((student) => student.class_id), [classB.id]);
  await assert.rejects(toggleStudentTask(family.id, 1, { task_id: taskA, enrollment_id: family.pupils[0].enrollment_id, completed: true }));
  await assert.rejects(savePost(administrator.id, postInput(classA.id)));
  fixture.database.prepare("UPDATE schools SET archived_at = ? WHERE id = 'school-ben-tre'").run(fixedTime.toISOString());
  assert.deepEqual((await getStudentClassContent(family.id, 1)).students, []);
  await assert.rejects(toggleStudentTask(family.id, 1, { task_id: taskB, enrollment_id: family.pupils[1].enrollment_id, completed: true }));
  await assert.rejects(saveEvent(administrator.id, eventInput(classB.id)));
  assert.deepEqual((await getTeacherContentOverview(administrator.id)).classes, []);
});

test("today's to-do and tomorrow's preparation include recurring items and exclude other dates", async () => {
  const family = seedFamily("family-test-a", [classA]);
  const visible = [];
  const cases = [
    ["TODO", null, true], ["TODO", "2026-10-15", true],
    ["TODO", "2026-10-14", false], ["TODO", "2026-10-16", false],
    ["PREPARATION", null, true], ["PREPARATION", "2026-10-16", true],
    ["PREPARATION", "2026-10-15", false], ["PREPARATION", "2026-10-17", false],
  ];
  for (const [kind, task_date, isVisible] of cases) {
    const id = await saveTask(administrator.id, taskInput(classA.id, { kind, task_date, title: `${kind}-${task_date ?? "recurring"}` }));
    if (isVisible) visible.push(id);
  }
  await saveTask(administrator.id, taskInput(classB.id, { title: "OTHER_CLASS_TASK" }));
  const content = await getStudentClassContent(family.id, 1);
  assert.equal(content.today, "2026-10-15");
  assert.equal(content.tomorrow, "2026-10-16");
  assert.deepEqual(content.students[0].tasks.map((task) => task.id).sort(), visible.sort());
});

test("only live verified administrators or currently assigned teachers can create content", async () => {
  const teacher = seedAssignedTeacher();
  assert.ok(await savePost(teacher.id, postInput()));
  assert.ok(await saveEvent(teacher.id, eventInput()));
  assert.ok(await saveTask(teacher.id, taskInput()));
  const deniedActors = [
    seedStaff({ role: "PENDING" }),
    seedStaff({ verified: false }),
    seedStaff({ status: "SUSPENDED" }),
    seedStaff({ role: "TEACHER" }),
    { id: seedFamily("family-test-a", [classA]).id },
  ];
  const beforeAudit = fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n;
  for (const actor of deniedActors) {
    await assert.rejects(savePost(actor.id, postInput()));
    await assert.rejects(saveEvent(actor.id, eventInput()));
    await assert.rejects(saveTask(actor.id, taskInput()));
    assert.deepEqual((await getTeacherContentOverview(actor.id)).classes, []);
  }
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM posts").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_events").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_tasks").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, beforeAudit);
});

test("teachers cannot write to another class and lose write access when their assignment ends", async () => {
  const teacher = seedAssignedTeacher();
  const post = await savePost(administrator.id, postInput(classB.id));
  await assert.rejects(savePost(teacher.id, postInput(classB.id)));
  await assert.rejects(saveEvent(teacher.id, eventInput(classB.id)));
  await assert.rejects(saveTask(teacher.id, taskInput(classB.id)));
  await assert.rejects(archiveContent(teacher.id, { type: "post", id: post }));
  fixture.database.prepare("UPDATE class_teachers SET ended_at = ? WHERE user_id = ?").run(fixedTime.toISOString(), teacher.id);
  await assert.rejects(savePost(teacher.id, postInput()));
  await assert.rejects(saveEvent(teacher.id, eventInput()));
  await assert.rejects(saveTask(teacher.id, taskInput()));
});

test("teacher overview is scoped to their assigned active classes including their drafts", async () => {
  const teacher = seedAssignedTeacher();
  const ownDraft = await savePost(administrator.id, postInput(classA.id, { status: "DRAFT", visibility: "PRIVATE" }));
  await savePost(administrator.id, postInput(classB.id, { title: "OTHER_TEACHER_POST" }));
  const ownEvent = await saveEvent(administrator.id, eventInput(classA.id));
  const ownTask = await saveTask(administrator.id, taskInput(classA.id));
  const overview = await getTeacherContentOverview(teacher.id);
  assert.deepEqual(overview.classes.map((classroom) => classroom.id), [classA.id]);
  assert.deepEqual(overview.posts.map((post) => post.id), [ownDraft]);
  assert.deepEqual(overview.events.map((event) => event.id), [ownEvent]);
  assert.deepEqual(overview.tasks.map((task) => task.id), [ownTask]);
  assert.equal(JSON.stringify(overview).includes("OTHER_TEACHER_POST"), false);
});

test("editing cannot move an existing post into a different classroom", async () => {
  const id = await savePost(administrator.id, postInput(classA.id, { title: "Original class-bound post" }));
  const auditBefore = fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n;
  await assert.rejects(savePost(administrator.id, postInput(classB.id, { id, title: "Wrong-class edit" })));
  const row = fixture.database.prepare("SELECT class_id, title FROM posts WHERE id = ?").get(id);
  assert.equal(row.class_id, classA.id);
  assert.equal(row.title, "Original class-bound post");
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, auditBefore);
});

test("archiving preserves content rows while removing them from student and public feeds", async () => {
  const family = seedFamily("family-test-a", [classA]);
  const entries = [
    ["post", "posts", await savePost(administrator.id, postInput())],
    ["event", "class_events", await saveEvent(administrator.id, eventInput())],
    ["task", "class_tasks", await saveTask(administrator.id, taskInput())],
  ];
  const beforeAudit = fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n;
  for (const [type, table, id] of entries) {
    await archiveContent(administrator.id, { type, id });
    assert.equal(fixture.database.prepare(`SELECT status FROM ${table} WHERE id = ?`).get(id).status, "ARCHIVED");
  }
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, beforeAudit + 3);
  const publicContent = await getPublicBulletin();
  assert.deepEqual(publicContent.posts, []);
  assert.deepEqual(publicContent.events, []);
  const space = (await getStudentClassContent(family.id, 1)).students[0];
  assert.deepEqual(space.posts, []);
  assert.deepEqual(space.events, []);
  assert.deepEqual(space.tasks, []);
});

test("a failed audit rolls back both creation and archival instead of leaving an unrecorded change", async () => {
  const existing = await savePost(administrator.id, postInput());
  const family = seedFamily("family-test-a", [classA]);
  const task = await saveTask(administrator.id, taskInput());
  fixture.database.exec(`CREATE TEMP TRIGGER fail_content_audit BEFORE INSERT ON audit_logs
    BEGIN SELECT RAISE(ABORT, 'intentional isolated-test audit failure'); END`);
  await assert.rejects(savePost(administrator.id, postInput(classA.id, { title: "Must roll back" })));
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM posts").get().n, 1);
  await assert.rejects(archiveContent(administrator.id, { type: "post", id: existing }));
  assert.equal(fixture.database.prepare("SELECT status FROM posts WHERE id = ?").get(existing).status, "PUBLISHED");
  await assert.rejects(toggleStudentTask(family.id, 1, { task_id: task, enrollment_id: family.pupils[0].enrollment_id, completed: true }));
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_task_completions").get().n, 0);
});

test("shared schemas require safe HTTPS covers, real dates and plain text inputs", () => {
  assert.equal(postSchema.safeParse(postInput(classA.id, { cover_url: "https://images.example.test/class.jpg" })).success, true);
  for (const cover_url of ["not-a-url", "http://images.example.test/class.jpg", "javascript:alert(1)", "data:image/png;base64,AA==", "https://user:password@images.example.test/class.jpg"]) {
    assert.equal(postSchema.safeParse(postInput(classA.id, { cover_url })).success, false);
  }
  const literalText = "<script>Text is displayed literally, without HTML rendering.</script>";
  assert.equal(postSchema.parse(postInput(classA.id, { body: literalText })).body, literalText);
  assert.equal(postSchema.safeParse(postInput(classA.id, { body: { html: literalText } })).success, false);
  assert.equal(postSchema.safeParse({ ...postInput(), created_by: "forged-user" }).success, false);
  assert.equal(eventSchema.safeParse(eventInput(classA.id, { event_date: "2026-02-30" })).success, false);
  assert.equal(eventSchema.safeParse(eventInput(classA.id, { starts_at: "24:00" })).success, false);
  assert.equal(taskSchema.safeParse(taskInput(classA.id, { sort_order: -1 })).success, false);
  assert.equal(toggleTaskSchema.safeParse({ task_id: "task-test", enrollment_id: "enrollment-test", completed: "false" }).data.completed, false);
  assert.equal(toggleTaskSchema.safeParse({ task_id: "task-test", enrollment_id: "enrollment-test", completed: "yes" }).success, false);
});

test("daily progress is scoped to each linked pupil and records Vietnam's current day", async () => {
  const family = seedFamily("family-test-a", [classA, classA]);
  const task = await saveTask(administrator.id, taskInput());
  const input = { task_id: task, enrollment_id: family.pupils[0].enrollment_id, completed: true };
  await toggleStudentTask(family.id, 1, input);
  await toggleStudentTask(family.id, 1, input);
  const completions = fixture.database.prepare("SELECT * FROM student_task_completions").all();
  assert.equal(completions.length, 1);
  assert.equal(completions[0].completion_date, "2026-10-15");
  const content = await getStudentClassContent(family.id, 1);
  assert.equal(content.students.find((student) => student.enrollment_id === input.enrollment_id).tasks[0].completed, true);
  assert.equal(content.students.find((student) => student.enrollment_id === family.pupils[1].enrollment_id).tasks[0].completed, false);
  await toggleStudentTask(family.id, 1, { ...input, completed: false });
  assert.equal((await getStudentClassContent(family.id, 1)).students.every((student) => !student.tasks[0].completed), true);
});

test("another family's enrollment or a task in another class cannot be toggled", async () => {
  const first = seedFamily("family-test-a", [classA]);
  const second = seedFamily("family-test-b", [classA]);
  const ownTask = await saveTask(administrator.id, taskInput());
  const otherClassTask = await saveTask(administrator.id, taskInput(classB.id));
  await assert.rejects(toggleStudentTask(first.id, 1, { task_id: ownTask, enrollment_id: second.pupils[0].enrollment_id, completed: true }));
  await assert.rejects(toggleStudentTask(first.id, 1, { task_id: otherClassTask, enrollment_id: first.pupils[0].enrollment_id, completed: true }));
  await assert.rejects(toggleStudentTask(first.id, 1, { task_id: ownTask, enrollment_id: "unknown-enrollment", completed: true }));
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_task_completions").get().n, 0);
});

test("password-change, stale-version and suspended sessions cannot toggle even their own tasks", async () => {
  const family = seedFamily("family-test-a", [classA]);
  const task = await saveTask(administrator.id, taskInput());
  const input = { task_id: task, enrollment_id: family.pupils[0].enrollment_id, completed: true };
  await assert.rejects(toggleStudentTask(family.id, 2, input));
  fixture.database.prepare("UPDATE student_accounts SET must_change_password = 1 WHERE id = ?").run(family.id);
  await assert.rejects(toggleStudentTask(family.id, 1, input));
  fixture.database.prepare("UPDATE student_accounts SET must_change_password = 0, status = 'SUSPENDED' WHERE id = ?").run(family.id);
  await assert.rejects(toggleStudentTask(family.id, 1, input));
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM student_task_completions").get().n, 0);
});

test("only tasks in today's to-do or tomorrow's preparation window accept progress changes", async () => {
  const family = seedFamily("family-test-a", [classA]);
  for (const [kind, task_date] of [["TODO", "2026-10-14"], ["TODO", "2026-10-16"], ["PREPARATION", "2026-10-15"]]) {
    const task = await saveTask(administrator.id, taskInput(classA.id, { kind, task_date }));
    await assert.rejects(toggleStudentTask(family.id, 1, { task_id: task, enrollment_id: family.pupils[0].enrollment_id, completed: true }));
  }
  const preparation = await saveTask(administrator.id, taskInput(classA.id, { kind: "PREPARATION", task_date: "2026-10-16" }));
  await toggleStudentTask(family.id, 1, { task_id: preparation, enrollment_id: family.pupils[0].enrollment_id, completed: true });
  assert.equal(fixture.database.prepare("SELECT completion_date FROM student_task_completions WHERE task_id = ?").get(preparation).completion_date, "2026-10-15");
  await archiveContent(administrator.id, { type: "task", id: preparation });
  await assert.rejects(toggleStudentTask(family.id, 1, { task_id: preparation, enrollment_id: family.pupils[0].enrollment_id, completed: false }));
});

test("recurring progress resets on the next Vietnam day without erasing yesterday's completion", async (context) => {
  const family = seedFamily("family-test-a", [classA]);
  const task = await saveTask(administrator.id, taskInput());
  const input = { task_id: task, enrollment_id: family.pupils[0].enrollment_id, completed: true };
  await toggleStudentTask(family.id, 1, input);
  context.mock.timers.setTime(new Date("2026-10-15T17:30:00.000Z").getTime());
  const nextDay = await getStudentClassContent(family.id, 1);
  assert.equal(nextDay.today, "2026-10-16");
  assert.equal(nextDay.students[0].tasks[0].completed, false);
  await toggleStudentTask(family.id, 1, input);
  assert.deepEqual(fixture.database.prepare("SELECT completion_date FROM student_task_completions ORDER BY completion_date").all()
    .map((row) => row.completion_date), ["2026-10-15", "2026-10-16"]);
});
