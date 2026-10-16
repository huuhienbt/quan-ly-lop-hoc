import "server-only";
import { batch, query, type D1Statement, type SqlValue } from "@/lib/d1";
import { addDays, vietnamToday } from "@/lib/content-schemas";
import {
  buildStudentTimetablePlan, emptyTimetablePlan, timetableDateSchema, timetableSchema,
  toggleTimetableCheckSchema,
  type StudentTimetablePlan, type TeacherTimetable, type TimetableInput,
  type TimetableLessonInput, type TimetablePlanRow, type ToggleTimetableCheckInput,
} from "@/lib/timetable-schemas";

export class TimetableActionError extends Error {
  constructor(message = "Chưa thể lưu thời khóa biểu. Thầy cô hãy tải lại trang và thử lại.") {
    super(message);
    this.name = "TimetableActionError";
  }
}
const activeClass = "c.archived_at IS NULL AND school.archived_at IS NULL";
const staffAccess = `EXISTS (SELECT 1 FROM users actor WHERE actor.id = ?
  AND actor.status = 'ACTIVE' AND actor.email_verified_at IS NOT NULL
  AND (actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER' AND EXISTS (
    SELECT 1 FROM class_teachers assignment WHERE assignment.class_id = c.id
      AND assignment.user_id = actor.id AND assignment.ended_at IS NULL))))`;
const studentAccess = `EXISTS (SELECT 1 FROM student_accounts login
  JOIN student_account_students link ON link.account_id = login.id
  JOIN students pupil ON pupil.id = link.student_id AND pupil.archived_at IS NULL
  JOIN student_enrollments enrollment ON enrollment.student_id = pupil.id
    AND enrollment.school_id = pupil.school_id AND enrollment.status = 'ACTIVE'
  WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
    AND login.must_change_password = 0 AND enrollment.id = ?
    AND enrollment.class_id = c.id AND enrollment.school_id = c.school_id
    AND enrollment.academic_year_id = c.academic_year_id)`;
const classJoins = `JOIN schools school ON school.id = c.school_id
  JOIN academic_years year ON year.id = c.academic_year_id AND year.school_id = c.school_id`;
const lessonFields = "lesson.weekday, lesson.session, lesson.starts_at, lesson.ends_at, lesson.subject, lesson.instructor, lesson.todo, lesson.preparation";
function validIdentity(id: string, version: number, enrollmentId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id) && /^[a-zA-Z0-9_-]{1,100}$/.test(enrollmentId)
    && Number.isSafeInteger(version) && version > 0;
}

export async function getTeacherTimetable(actorId: string, classId: string): Promise<TeacherTimetable> {
  const row = (await query<{ revision: number; effective_from: string | null; version_id: string | null }>(`
    SELECT COALESCE(setting.revision, 0) AS revision, version.effective_from, version.id AS version_id
    FROM classes c ${classJoins}
    LEFT JOIN class_timetable_settings setting ON setting.class_id = c.id
    LEFT JOIN class_timetable_versions version ON version.class_id = c.id AND version.revision = setting.revision
    WHERE c.id = ? AND ${activeClass} AND ${staffAccess}`, [classId, actorId]))[0];
  if (!row) throw new TimetableActionError("Thầy cô không có quyền xem thời khóa biểu lớp này.");
  if (!row.version_id) return { revision: row.revision, effective_from: "", lessons: [] };
  const lessons = await query<TimetableLessonInput>(`SELECT ${lessonFields} FROM class_timetable_lessons lesson
    JOIN classes c ON c.id = lesson.class_id ${classJoins}
    WHERE lesson.version_id = ? AND c.id = ? AND ${activeClass} AND ${staffAccess}
    ORDER BY lesson.weekday, lesson.starts_at, lesson.id`, [row.version_id, classId, actorId]);
  return { revision: row.revision, effective_from: row.effective_from!, lessons };
}

export async function saveClassTimetable(actorId: string, value: TimetableInput): Promise<{ id: string; revision: number }> {
  const parsed = timetableSchema.safeParse(value);
  if (!parsed.success) throw new TimetableActionError("Thông tin thời khóa biểu chưa hợp lệ.");
  const input = parsed.data;
  const classroom = (await query<{ starts_on: string; ends_on: string }>(`SELECT year.starts_on, year.ends_on
    FROM classes c ${classJoins} WHERE c.id = ? AND ${activeClass} AND ${staffAccess}`,
  [input.class_id, actorId]))[0];
  if (!classroom) throw new TimetableActionError("Thầy cô không có quyền sửa thời khóa biểu lớp này.");
  if (input.effective_from < classroom.starts_on || input.effective_from > classroom.ends_on) {
    throw new TimetableActionError("Ngày áp dụng cần nằm trong năm học của lớp.");
  }
  // Repeat both bounds and permissions inside the batch after this helpful validation.
  const id = crypto.randomUUID(), token = crypto.randomUUID(), now = new Date().toISOString();
  const revision = input.revision + 1;
  const guard = `c.id = ? AND ${activeClass} AND ${staffAccess}
    AND ? BETWEEN year.starts_on AND year.ends_on`;
  const access = [input.class_id, actorId, input.effective_from];
  const statements: D1Statement[] = [{
    sql: `INSERT INTO class_timetable_settings (class_id, revision, updated_at)
      SELECT c.id, 0, ? FROM classes c ${classJoins}
      WHERE ? = 0 AND ${guard} ON CONFLICT(class_id) DO NOTHING`,
    params: [now, input.revision, ...access],
  }, {
    sql: `UPDATE class_timetable_settings SET revision = ?, write_token = ?, updated_by = ?, updated_at = ?
      WHERE class_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM classes c ${classJoins} WHERE ${guard})`,
    params: [revision, token, actorId, now, input.class_id, input.revision, ...access],
  }, {
    sql: `INSERT INTO class_timetable_versions (id, class_id, revision, effective_from, created_by, created_at)
      SELECT ?, c.id, ?, ?, ?, ? FROM classes c ${classJoins}
      JOIN class_timetable_settings setting ON setting.class_id = c.id
      WHERE changes() > 0 AND setting.revision = ? AND setting.write_token = ? AND ${guard}`,
    params: [id, revision, input.effective_from, actorId, now, revision, token, ...access],
  }];
  // Six rows keep every statement well below D1's 100-bound-parameter limit.
  for (let offset = 0; offset < input.lessons.length; offset += 6) {
    const lessons = input.lessons.slice(offset, offset + 6);
    const values = lessons.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const params: SqlValue[] = lessons.flatMap((lesson) => [crypto.randomUUID(), lesson.weekday,
      lesson.session, lesson.starts_at, lesson.ends_at, lesson.subject,
      lesson.subject.normalize("NFC").toLocaleLowerCase("vi"), lesson.instructor, lesson.todo, lesson.preparation]);
    statements.push({
      sql: `WITH entries(id, weekday, session, starts_at, ends_at, subject, subject_key, instructor, todo, preparation) AS (VALUES ${values})
        INSERT INTO class_timetable_lessons (id, class_id, version_id, weekday, session, starts_at, ends_at, subject, subject_key, instructor, todo, preparation)
        SELECT entries.id, c.id, version.id, entries.weekday, entries.session, entries.starts_at, entries.ends_at,
          entries.subject, entries.subject_key, entries.instructor, entries.todo, entries.preparation
        FROM entries CROSS JOIN class_timetable_versions version JOIN classes c ON c.id = version.class_id ${classJoins}
        JOIN class_timetable_settings setting ON setting.class_id = c.id
        WHERE version.id = ? AND setting.revision = version.revision AND setting.write_token = ? AND ${guard}`,
      params: [...params, id, token, ...access],
    });
  }
  statements.push({
    sql: `INSERT INTO audit_logs (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
      SELECT ?, ?, c.school_id, c.id, 'TIMETABLE_SAVED', 'class_timetable', version.id, ?
      FROM class_timetable_versions version JOIN classes c ON c.id = version.class_id ${classJoins}
      JOIN class_timetable_settings setting ON setting.class_id = c.id
      WHERE version.id = ? AND setting.revision = version.revision AND setting.write_token = ? AND ${guard}`,
    params: [crypto.randomUUID(), actorId, JSON.stringify({ revision, effective_from: input.effective_from, lesson_count: input.lessons.length }), id, token, ...access],
  });
  const result = await batch(statements);
  if (result[1].meta.changes !== 1) throw new TimetableActionError("Thời khóa biểu đã được thay đổi hoặc quyền truy cập đã đổi. Thầy cô hãy tải lại trang trước khi lưu.");
  if (result[2].meta.changes !== 1) throw new TimetableActionError();
  return { id, revision };
}

interface PlanQueryRow extends Omit<TimetablePlanRow, "id"> { id: string | null; version_id: string | null }
export async function getStudentTimetablePlan(
  accountId: string, sessionVersion: number, enrollmentId: string, today = vietnamToday(),
): Promise<StudentTimetablePlan> {
  if (!validIdentity(accountId, sessionVersion, enrollmentId) || !timetableDateSchema.safeParse(today).success) return emptyTimetablePlan();
  const dates = Array.from({ length: 15 }, (_, offset) => addDays(today, offset));
  const rows = await query<PlanQueryRow>(`WITH calendar(lesson_date) AS (VALUES ${dates.map(() => "(?)").join(", ")})
    SELECT calendar.lesson_date, version.id AS version_id, version.effective_from, lesson.id, ${lessonFields},
      EXISTS (SELECT 1 FROM student_timetable_checks checked WHERE checked.lesson_id = lesson.id
        AND checked.class_id = c.id AND checked.enrollment_id = ? AND checked.lesson_date = calendar.lesson_date AND checked.kind = 'TODO') AS todo_completed,
      EXISTS (SELECT 1 FROM student_timetable_checks checked WHERE checked.lesson_id = lesson.id
        AND checked.class_id = c.id AND checked.enrollment_id = ? AND checked.lesson_date = calendar.lesson_date AND checked.kind = 'PREPARATION') AS preparation_completed
    FROM calendar CROSS JOIN classes c ${classJoins}
    LEFT JOIN class_timetable_versions version ON version.id = (SELECT applicable.id FROM class_timetable_versions applicable
      WHERE applicable.class_id = c.id AND applicable.effective_from <= calendar.lesson_date ORDER BY applicable.revision DESC LIMIT 1)
    LEFT JOIN class_timetable_lessons lesson ON lesson.version_id = version.id AND lesson.class_id = c.id
      AND lesson.weekday = CASE strftime('%w', calendar.lesson_date) WHEN '0' THEN 7 ELSE CAST(strftime('%w', calendar.lesson_date) AS INTEGER) END
    WHERE calendar.lesson_date BETWEEN year.starts_on AND year.ends_on
      AND c.id = (SELECT own_enrollment.class_id FROM student_enrollments own_enrollment WHERE own_enrollment.id = ?)
      AND ${activeClass} AND ${studentAccess}
    ORDER BY calendar.lesson_date, lesson.starts_at, lesson.id`, [...dates, enrollmentId, enrollmentId, enrollmentId, accountId, sessionVersion, enrollmentId]);
  const plan = buildStudentTimetablePlan(rows.filter((row): row is PlanQueryRow & { id: string } => !!row.id), today);
  return { ...plan, hasTimetable: rows.some((row) => !!row.version_id),
    effectiveFrom: rows.find((row) => row.lesson_date === today && row.version_id)?.effective_from ?? plan.effectiveFrom };
}

export async function toggleTimetableCheck(accountId: string, sessionVersion: number, value: ToggleTimetableCheckInput): Promise<void> {
  const parsed = toggleTimetableCheckSchema.safeParse(value);
  if (!parsed.success || !validIdentity(accountId, sessionVersion, parsed.success ? parsed.data.enrollment_id : "")) throw new TimetableActionError();
  const input = parsed.data, today = vietnamToday();
  const plan = await getStudentTimetablePlan(accountId, sessionVersion, input.enrollment_id, today);
  const date = input.kind === "TODO" ? plan.today : plan.preparationDate;
  const subjects = input.kind === "TODO" ? plan.todaySubjects : plan.preparationSubjects;
  if (date !== input.lesson_date || !subjects.some((subject) => subject.lessonId === input.lesson_id)) {
    throw new TimetableActionError("Thời khóa biểu đã thay đổi. Em hãy tải lại trang nhé.");
  }
  const dates = Array.from({ length: 14 }, (_, offset) => addDays(today, offset + 1));
  const calendar = `WITH calendar(lesson_date) AS (VALUES ${dates.map(() => "(?)").join(", ")})`;
  // Compute the next school day again inside the atomic write. A teacher may have
  // saved a new revision after the initial plan read; stale checkboxes then fail.
  const guard = `lesson.id = ? AND ${activeClass} AND ${studentAccess}
    AND ? BETWEEN year.starts_on AND year.ends_on
    AND version.id = (SELECT applicable.id FROM class_timetable_versions applicable
      WHERE applicable.class_id = c.id AND applicable.effective_from <= ? ORDER BY applicable.revision DESC LIMIT 1)
    AND lesson.weekday = CASE strftime('%w', ?) WHEN '0' THEN 7 ELSE CAST(strftime('%w', ?) AS INTEGER) END
    AND lesson.id = (SELECT first_lesson.id FROM class_timetable_lessons first_lesson
      WHERE first_lesson.version_id = version.id AND first_lesson.weekday = lesson.weekday AND first_lesson.subject_key = lesson.subject_key
      ORDER BY first_lesson.starts_at, first_lesson.id LIMIT 1)
    AND ((? = 'TODO' AND ? = ?) OR (? = 'PREPARATION' AND ? = (
      SELECT MIN(calendar.lesson_date) FROM calendar
      JOIN class_timetable_versions next_version ON next_version.id = (SELECT applicable.id FROM class_timetable_versions applicable
        WHERE applicable.class_id = c.id AND applicable.effective_from <= calendar.lesson_date ORDER BY applicable.revision DESC LIMIT 1)
      JOIN class_timetable_lessons next_lesson ON next_lesson.version_id = next_version.id
        AND next_lesson.weekday = CASE strftime('%w', calendar.lesson_date) WHEN '0' THEN 7 ELSE CAST(strftime('%w', calendar.lesson_date) AS INTEGER) END
      WHERE calendar.lesson_date BETWEEN year.starts_on AND year.ends_on)))`;
  const joins = `FROM class_timetable_lessons lesson
    JOIN class_timetable_versions version ON version.id = lesson.version_id AND version.class_id = lesson.class_id
    JOIN classes c ON c.id = lesson.class_id ${classJoins}`;
  const guardParams = [input.lesson_id, accountId, sessionVersion, input.enrollment_id,
    input.lesson_date, input.lesson_date, input.lesson_date, input.lesson_date,
    input.kind, input.lesson_date, today, input.kind, input.lesson_date];
  const statement: D1Statement = input.completed ? {
    sql: `${calendar} INSERT INTO student_timetable_checks (lesson_id, enrollment_id, class_id, kind, lesson_date)
      SELECT lesson.id, ?, c.id, ?, ? ${joins} WHERE ${guard}
      ON CONFLICT(lesson_id, enrollment_id, kind, lesson_date) DO NOTHING`,
    params: [...dates, input.enrollment_id, input.kind, input.lesson_date, ...guardParams],
  } : {
    sql: `${calendar} DELETE FROM student_timetable_checks
      WHERE enrollment_id = ? AND lesson_id = ? AND kind = ? AND lesson_date = ?
      AND EXISTS (SELECT 1 ${joins} WHERE c.id = student_timetable_checks.class_id AND ${guard})`,
    params: [...dates, input.enrollment_id, input.lesson_id, input.kind, input.lesson_date, ...guardParams],
  };
  const results = await batch([statement, {
    sql: `${calendar} SELECT lesson.id ${joins} WHERE ${guard}`,
    params: [...dates, ...guardParams],
  }]);
  if (results[1].results.length !== 1) throw new TimetableActionError("Thông tin đã thay đổi. Em hãy tải lại trang rồi thử nhé.");
}
