import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  AdminActionError,
  addAcademicYear,
  addClass,
  adminSchemas,
  changeUserStatus,
  endHomeroomTeacher,
  reviewTeacherRequest,
  setHomeroomTeacher,
} from "../src/lib/admin.ts";
import { D1Error } from "../src/lib/d1.ts";
import { createD1Fixture, insertTeacherRequest, insertUser } from "./d1-fixture.mjs";

let fixture;
let administrator;
beforeEach(() => {
  fixture = createD1Fixture();
  administrator = insertUser(fixture.database, { role: "SUPER_ADMIN" });
});
afterEach(() => { fixture.restore(); });

const yearInput = {
  name: "2026–2027",
  starts_on: "2026-09-01",
  ends_on: "2027-05-31",
  is_current: true,
};

function approvedTeacher(options = {}) {
  const teacher = insertUser(fixture.database, { role: "TEACHER", ...options });
  insertTeacherRequest(fixture.database, teacher.id, {
    status: "APPROVED",
    reviewed_by: administrator.id,
  });
  return teacher;
}

async function createClass() {
  await addAcademicYear(administrator.id, yearInput);
  const year = fixture.database.prepare("SELECT id FROM academic_years").get();
  await addClass(administrator.id, {
    name: "Bốn 12",
    slug: "bon-12-2026-2027",
    grade: 4,
    academic_year_id: year.id,
  });
  return fixture.database.prepare("SELECT * FROM classes").get();
}

test("approving a request changes only the pending applicant and records the reviewer", async () => {
  const applicant = insertUser(fixture.database);
  const request = insertTeacherRequest(fixture.database, applicant.id);
  await reviewTeacherRequest(administrator.id, { request_id: request.id, review_note: "GVCN đã được xác minh" }, "APPROVED");
  assert.equal(fixture.database.prepare("SELECT role FROM users WHERE id = ?").get(applicant.id).role, "TEACHER");
  const reviewed = fixture.database.prepare("SELECT * FROM teacher_requests WHERE id = ?").get(request.id);
  assert.equal(reviewed.status, "APPROVED");
  assert.equal(reviewed.reviewed_by, administrator.id);
  assert.ok(reviewed.reviewed_at);
  assert.equal(reviewed.review_note, "GVCN đã được xác minh");
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs WHERE action = 'TEACHER_APPROVED'").get().n, 1);
  await assert.rejects(reviewTeacherRequest(administrator.id, { request_id: request.id }, "APPROVED"), AdminActionError);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, 1);
});

test("rejecting a request leaves the user pending and cannot be replayed as an approval", async () => {
  const applicant = insertUser(fixture.database);
  const request = insertTeacherRequest(fixture.database, applicant.id);
  await reviewTeacherRequest(administrator.id, { request_id: request.id }, "REJECTED");
  assert.equal(fixture.database.prepare("SELECT role FROM users WHERE id = ?").get(applicant.id).role, "PENDING");
  assert.equal(fixture.database.prepare("SELECT status FROM teacher_requests WHERE id = ?").get(request.id).status, "REJECTED");
  await assert.rejects(reviewTeacherRequest(administrator.id, { request_id: request.id }, "APPROVED"), AdminActionError);
});

test("pending users, teachers and suspended admins cannot execute any administrator mutation", async () => {
  const classroom = await createClass();
  const teacher = approvedTeacher();
  await setHomeroomTeacher(administrator.id, { class_id: classroom.id, user_id: teacher.id });
  const applicant = insertUser(fixture.database);
  const request = insertTeacherRequest(fixture.database, applicant.id);
  const actors = [
    insertUser(fixture.database),
    approvedTeacher(),
    insertUser(fixture.database, { role: "SUPER_ADMIN", status: "SUSPENDED" }),
  ];
  const beforeAuditCount = fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n;
  for (const actor of actors) {
    const commands = [
      () => reviewTeacherRequest(actor.id, { request_id: request.id }, "APPROVED"),
      () => reviewTeacherRequest(actor.id, { request_id: request.id }, "REJECTED"),
      () => addAcademicYear(actor.id, { ...yearInput, name: "Không có quyền" }),
      () => addClass(actor.id, { name: "Không có quyền", slug: "unauthorized-class", grade: 4, academic_year_id: classroom.academic_year_id }),
      () => setHomeroomTeacher(actor.id, { class_id: classroom.id, user_id: teacher.id }),
      () => endHomeroomTeacher(actor.id, { class_id: classroom.id, user_id: teacher.id }),
      () => changeUserStatus(actor.id, { user_id: applicant.id, status: "SUSPENDED" }),
    ];
    for (const command of commands) await assert.rejects(command(), AdminActionError);
  }
  assert.equal(fixture.database.prepare("SELECT role, status FROM users WHERE id = ?").get(applicant.id).role, "PENDING");
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM academic_years").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM classes").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_teachers WHERE ended_at IS NULL").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, beforeAuditCount);
});

test("a previously authorized actor loses mutation access immediately after role revocation", async () => {
  fixture.database.prepare("UPDATE users SET role = 'PENDING' WHERE id = ?").run(administrator.id);
  await assert.rejects(addAcademicYear(administrator.id, yearInput), AdminActionError);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM academic_years").get().n, 0);
});

test("approval cannot promote a suspended applicant or overwrite a super administrator", async () => {
  const targets = [
    insertUser(fixture.database, { status: "SUSPENDED" }),
    insertUser(fixture.database, { role: "SUPER_ADMIN" }),
  ];
  for (const target of targets) {
    const request = insertTeacherRequest(fixture.database, target.id);
    await assert.rejects(reviewTeacherRequest(administrator.id, { request_id: request.id }, "APPROVED"), AdminActionError);
    const current = fixture.database.prepare("SELECT role, status FROM users WHERE id = ?").get(target.id);
    assert.equal(current.role, target.role);
    assert.equal(current.status, target.status);
    assert.equal(fixture.database.prepare("SELECT status FROM teacher_requests WHERE id = ?").get(request.id).status, "PENDING");
  }
});

test("failed replacement of the current academic year rolls back the previous current flag", async () => {
  await addAcademicYear(administrator.id, yearInput);
  await assert.rejects(addAcademicYear(administrator.id, yearInput), D1Error);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM academic_years").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT is_current FROM academic_years").get().is_current, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, 1);
});

test("an archived school cannot create a year or silently clear its existing current year", async () => {
  await addAcademicYear(administrator.id, yearInput);
  fixture.database.prepare("UPDATE schools SET archived_at = ? WHERE id = ?")
    .run(new Date().toISOString(), "school-ben-tre");
  await assert.rejects(addAcademicYear(administrator.id, { ...yearInput, name: "2027–2028" }), AdminActionError);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM academic_years").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT is_current FROM academic_years").get().is_current, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, 1);
});

test("new classes remain private and SQL-like names are treated as bound text", async () => {
  await addAcademicYear(administrator.id, yearInput);
  const year = fixture.database.prepare("SELECT id FROM academic_years").get();
  const className = "Bốn '12'; DROP TABLE users; --";
  await addClass(administrator.id, { name: className, slug: "bon-12-2026", grade: 4, academic_year_id: year.id });
  const classroom = fixture.database.prepare("SELECT * FROM classes").get();
  assert.equal(classroom.name, className);
  assert.equal(classroom.visibility, "PRIVATE");
  assert.equal(classroom.created_by, administrator.id);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM users").get().n, 1);
});

test("a year belonging to another school cannot be used to create a Bến Tre class", async () => {
  fixture.database.exec("INSERT INTO schools (id,name,slug) VALUES ('other-school','Trường khác','truong-khac')");
  fixture.database.prepare("INSERT INTO academic_years (id,school_id,name,starts_on,ends_on) VALUES (?,?,?,?,?)")
    .run("other-year", "other-school", "2026–2027", yearInput.starts_on, yearInput.ends_on);
  await assert.rejects(addClass(administrator.id, { name: "Bốn 12", slug: "bon-12", grade: 4, academic_year_id: "other-year" }), AdminActionError);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM classes").get().n, 0);
});

test("switching homeroom teachers ends the previous assignment and supports reassignment", async () => {
  const classroom = await createClass();
  const first = approvedTeacher();
  const second = approvedTeacher();
  await setHomeroomTeacher(administrator.id, { class_id: classroom.id, user_id: first.id });
  await setHomeroomTeacher(administrator.id, { class_id: classroom.id, user_id: second.id });
  let assignments = fixture.database.prepare("SELECT * FROM class_teachers WHERE class_id = ?").all(classroom.id);
  assert.ok(assignments.find((row) => row.user_id === first.id).ended_at);
  assert.equal(assignments.find((row) => row.user_id === second.id).ended_at, null);
  await setHomeroomTeacher(administrator.id, { class_id: classroom.id, user_id: first.id });
  assignments = fixture.database.prepare("SELECT * FROM class_teachers WHERE class_id = ? AND ended_at IS NULL").all(classroom.id);
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].user_id, first.id);
});

test("an ineligible replacement cannot remove the current homeroom teacher", async () => {
  const classroom = await createClass();
  const first = approvedTeacher();
  await setHomeroomTeacher(administrator.id, { class_id: classroom.id, user_id: first.id });
  const replacements = [
    insertUser(fixture.database),
    insertUser(fixture.database, { role: "TEACHER" }),
    approvedTeacher({ status: "SUSPENDED" }),
    administrator,
  ];
  for (const replacement of replacements) {
    await assert.rejects(setHomeroomTeacher(administrator.id, { class_id: classroom.id, user_id: replacement.id }), AdminActionError);
  }
  const current = fixture.database.prepare("SELECT user_id FROM class_teachers WHERE ended_at IS NULL").all();
  assert.equal(current.length, 1);
  assert.equal(current[0].user_id, first.id);
});

test("suspension ends an assigned teacher's access; reactivation does not restore that assignment", async () => {
  const classroom = await createClass();
  const teacher = approvedTeacher();
  await setHomeroomTeacher(administrator.id, { class_id: classroom.id, user_id: teacher.id });
  await changeUserStatus(administrator.id, { user_id: teacher.id, status: "SUSPENDED" });
  const endedAt = fixture.database.prepare("SELECT ended_at FROM class_teachers WHERE user_id = ?").get(teacher.id).ended_at;
  assert.ok(endedAt);
  await changeUserStatus(administrator.id, { user_id: teacher.id, status: "ACTIVE" });
  assert.equal(fixture.database.prepare("SELECT ended_at FROM class_teachers WHERE user_id = ?").get(teacher.id).ended_at, endedAt);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM class_teachers WHERE ended_at IS NULL").get().n, 0);
});

test("administrators cannot suspend themselves or other super administrators", async () => {
  const otherAdministrator = insertUser(fixture.database, { role: "SUPER_ADMIN" });
  for (const user of [administrator, otherAdministrator]) {
    await assert.rejects(changeUserStatus(administrator.id, { user_id: user.id, status: "SUSPENDED" }), AdminActionError);
    assert.equal(fixture.database.prepare("SELECT status FROM users WHERE id = ?").get(user.id).status, "ACTIVE");
  }
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM audit_logs").get().n, 0);
});

test("administrator input schemas reject impossible dates, grade overflow and privilege fields", () => {
  assert.equal(adminSchemas.year.safeParse({ ...yearInput, starts_on: "2026-02-30", is_current: "on" }).success, false);
  assert.equal(adminSchemas.year.safeParse({ ...yearInput, ends_on: "2026-08-31", is_current: "on" }).success, false);
  const classInput = { name: "Bốn 12", slug: "bon-12", grade: "4", academic_year_id: "year-1" };
  assert.equal(adminSchemas.class.safeParse({ ...classInput, grade: "6" }).success, false);
  assert.equal(adminSchemas.class.safeParse({ ...classInput, visibility: "PUBLIC" }).success, false);
  assert.equal(adminSchemas.userStatus.safeParse({ user_id: "user-1", status: "ACTIVE", role: "SUPER_ADMIN" }).success, false);
  assert.equal(adminSchemas.class.parse(classInput).grade, 4);
});
