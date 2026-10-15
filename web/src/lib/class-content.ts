import "server-only";

import { batch, query, type D1Statement } from "@/lib/d1";
import {
  archiveContentSchema,
  eventSchema,
  getVietnamDateWindow,
  postSchema,
  taskSchema,
  toggleTaskSchema,
  type ArchiveContentInput,
  type ClassEvent,
  type ClassTask,
  type ContentClass,
  type ContentPost,
  type EventInput,
  type PostInput,
  type PublicBulletin,
  type StudentClassContent,
  type StudentClassSpace,
  type TaskInput,
  type TeacherContentOverview,
  type ToggleTaskInput,
} from "@/lib/content-schemas";

export type {
  ContentPost, ClassEvent, ClassTask, StudentTask, StudentClassSpace,
  ContentClass, PublicBulletin, StudentClassContent, TeacherContentOverview,
} from "@/lib/content-schemas";

export class ContentActionError extends Error {
  constructor(message = "Không thể lưu nội dung. Hãy kiểm tra quyền truy cập và thử lại.") {
    super(message);
    this.name = "ContentActionError";
  }
}

const activeClass = "c.archived_at IS NULL AND school.archived_at IS NULL";
const staffAccess = `EXISTS (
  SELECT 1 FROM users actor WHERE actor.id = ? AND actor.status = 'ACTIVE'
    AND actor.email_verified_at IS NOT NULL
    AND (actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER' AND EXISTS (
      SELECT 1 FROM class_teachers assignment WHERE assignment.class_id = c.id
        AND assignment.user_id = actor.id AND assignment.ended_at IS NULL
    )))
)`;

// This is repeated in every student read/write rather than relying on a session snapshot.
// Parameters: account ID, current session version, exact owned enrollment ID.
const studentAccess = `EXISTS (
  SELECT 1 FROM student_accounts login
  JOIN student_account_students link ON link.account_id = login.id
  JOIN students pupil ON pupil.id = link.student_id AND pupil.archived_at IS NULL
  JOIN student_enrollments enrollment ON enrollment.student_id = pupil.id
    AND enrollment.school_id = pupil.school_id AND enrollment.status = 'ACTIVE'
  WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
    AND login.must_change_password = 0 AND enrollment.id = ?
    AND enrollment.class_id = c.id AND enrollment.school_id = c.school_id
    AND enrollment.academic_year_id = c.academic_year_id
)`;

const classJoins = "JOIN classes c ON c.id = p.class_id JOIN schools school ON school.id = c.school_id";
const eventJoins = "JOIN classes c ON c.id = event.class_id JOIN schools school ON school.id = c.school_id";
const taskJoins = "JOIN classes c ON c.id = task.class_id JOIN schools school ON school.id = c.school_id";
const postFields = `p.id, p.class_id, c.name AS class_name, c.slug AS class_slug,
  p.title, p.body, p.kind, p.category, p.cover_url, p.status, p.visibility,
  p.is_pinned, p.published_at, p.created_at, p.updated_at`;
const eventFields = `event.id, event.class_id, c.name AS class_name, c.slug AS class_slug,
  event.title, event.body, event.event_date, event.starts_at, event.visibility,
  event.status, event.created_at, event.updated_at`;
const taskFields = `task.id, task.class_id, c.name AS class_name, c.slug AS class_slug,
  task.title, task.details, task.kind, task.task_date, task.sort_order,
  task.status, task.created_at, task.updated_at`;
const postOrder = "p.is_pinned DESC, p.published_at DESC, p.created_at DESC, p.id";
const eventOrder = "event.event_date, COALESCE(event.starts_at, '99:99'), event.id";
const taskWindow = `((task.kind = 'TODO' AND (task.task_date IS NULL OR task.task_date = ?))
  OR (task.kind = 'PREPARATION' AND (task.task_date IS NULL OR task.task_date = ?)))`;

export async function getPublicBulletin(): Promise<PublicBulletin> {
  const calendar = getVietnamDateWindow();
  const [posts, events] = await Promise.all([
    query<ContentPost>(`SELECT ${postFields} FROM posts p ${classJoins}
      WHERE p.status = 'PUBLISHED' AND p.visibility = 'PUBLIC' AND ${activeClass}
      ORDER BY ${postOrder} LIMIT 30`),
    query<ClassEvent>(`SELECT ${eventFields} FROM class_events event ${eventJoins}
      WHERE event.status = 'PUBLISHED' AND event.visibility = 'PUBLIC' AND ${activeClass}
        AND event.event_date BETWEEN ? AND ? ORDER BY ${eventOrder} LIMIT 100`,
    [calendar.weekStart, calendar.weekEnd]),
  ]);
  // An explicit PUBLIC flag publishes only this editorial item, even for a private class.
  // These projections never join pupil/account records or expose staff email addresses.
  return { ...calendar, posts, events };
}

export async function getPublicPost(id: string): Promise<ContentPost | null> {
  if (!archiveContentSchema.shape.id.safeParse(id).success) return null;
  return (await query<ContentPost>(`SELECT ${postFields} FROM posts p ${classJoins}
    WHERE p.id = ? AND p.status = 'PUBLISHED' AND p.visibility = 'PUBLIC' AND ${activeClass}`, [id]))[0] ?? null;
}

type StudentSpaceIdentity = Omit<StudentClassSpace, "posts" | "events" | "tasks">;
interface StudentTaskRow extends ClassTask { completed: number }

function validStudentIdentity(accountId: string, version: number) {
  return typeof accountId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(accountId)
    && Number.isSafeInteger(version) && version > 0;
}

export async function getStudentClassContent(accountId: string, sessionVersion: number): Promise<StudentClassContent> {
  const calendar = getVietnamDateWindow();
  if (!validStudentIdentity(accountId, sessionVersion)) return { ...calendar, students: [] };
  const identities = await query<StudentSpaceIdentity>(`SELECT enrollment.id AS enrollment_id,
      pupil.id AS student_id, COALESCE(NULLIF(pupil.display_name, ''), pupil.full_name) AS student_name,
      c.id AS class_id, c.name AS class_name, c.slug AS class_slug, school.name AS school_name
    FROM student_accounts login
    JOIN student_account_students link ON link.account_id = login.id
    JOIN students pupil ON pupil.id = link.student_id AND pupil.archived_at IS NULL
    JOIN student_enrollments enrollment ON enrollment.student_id = pupil.id
      AND enrollment.school_id = pupil.school_id AND enrollment.status = 'ACTIVE'
    JOIN classes c ON c.id = enrollment.class_id AND c.school_id = enrollment.school_id
      AND c.academic_year_id = enrollment.academic_year_id
    JOIN schools school ON school.id = c.school_id
    WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
      AND login.must_change_password = 0 AND ${activeClass}
    ORDER BY pupil.full_name, c.name, enrollment.id`, [accountId, sessionVersion]);
  const students = await Promise.all(identities.map(async (identity): Promise<StudentClassSpace> => {
    const own = [accountId, sessionVersion, identity.enrollment_id];
    const [posts, events, taskRows] = await Promise.all([
      query<ContentPost>(`SELECT ${postFields} FROM posts p ${classJoins}
        WHERE c.id = ? AND p.status = 'PUBLISHED' AND ${activeClass} AND ${studentAccess}
        ORDER BY ${postOrder} LIMIT 100`, [identity.class_id, ...own]),
      query<ClassEvent>(`SELECT ${eventFields} FROM class_events event ${eventJoins}
        WHERE c.id = ? AND event.status = 'PUBLISHED' AND ${activeClass} AND ${studentAccess}
          AND event.event_date BETWEEN ? AND ? ORDER BY ${eventOrder}`,
      [identity.class_id, ...own, calendar.weekStart, calendar.weekEnd]),
      query<StudentTaskRow>(`SELECT ${taskFields}, EXISTS (
          SELECT 1 FROM student_task_completions completion WHERE completion.task_id = task.id
            AND completion.class_id = task.class_id AND completion.enrollment_id = ? AND completion.completion_date = ?
        ) AS completed FROM class_tasks task ${taskJoins}
        WHERE c.id = ? AND task.status = 'PUBLISHED' AND ${activeClass} AND ${studentAccess}
          AND ${taskWindow} ORDER BY task.kind DESC, task.sort_order, task.title, task.id`,
      [identity.enrollment_id, calendar.today, identity.class_id, ...own, calendar.today, calendar.tomorrow]),
    ]);
    return { ...identity, posts, events, tasks: taskRows.map((task) => ({ ...task, completed: task.completed === 1 })) };
  }));
  return { ...calendar, students };
}

export async function getTeacherContentOverview(actorId: string): Promise<TeacherContentOverview> {
  const calendar = getVietnamDateWindow();
  const [classes, posts, events, tasks] = await Promise.all([
    query<ContentClass>(`SELECT c.id, c.name, c.slug, c.school_id, school.name AS school_name
      FROM classes c JOIN schools school ON school.id = c.school_id
      WHERE ${activeClass} AND ${staffAccess} ORDER BY c.grade, c.name, c.id`, [actorId]),
    query<ContentPost>(`SELECT ${postFields} FROM posts p ${classJoins}
      WHERE p.status <> 'ARCHIVED' AND ${activeClass} AND ${staffAccess}
      ORDER BY ${postOrder} LIMIT 500`, [actorId]),
    query<ClassEvent>(`SELECT ${eventFields} FROM class_events event ${eventJoins}
      WHERE event.status <> 'ARCHIVED' AND ${activeClass} AND ${staffAccess}
      ORDER BY ${eventOrder} LIMIT 500`, [actorId]),
    query<ClassTask>(`SELECT ${taskFields} FROM class_tasks task ${taskJoins}
      WHERE task.status <> 'ARCHIVED' AND ${activeClass} AND ${staffAccess}
      ORDER BY task.sort_order, task.title, task.id LIMIT 500`, [actorId]),
  ]);
  return { ...calendar, classes, posts, events, tasks };
}

function staffAudit(
  actorId: string, classId: string, action: string,
  entityType: string, entityId: string, details: Record<string, unknown>,
): D1Statement {
  return {
    sql: `INSERT INTO audit_logs
        (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
      SELECT ?, ?, c.school_id, c.id, ?, ?, ?, ? FROM classes c
      JOIN schools school ON school.id = c.school_id
      WHERE changes() > 0 AND c.id = ? AND ${activeClass} AND ${staffAccess}`,
    params: [crypto.randomUUID(), actorId, action, entityType, entityId, JSON.stringify(details), classId, actorId],
  };
}

export async function savePost(actorId: string, input: PostInput): Promise<string> {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) throw new ContentActionError("Nội dung bài viết không hợp lệ.");
  input = parsed.data;
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const statement: D1Statement = input.id ? {
    sql: `UPDATE posts SET title = ?, body = ?, kind = ?, category = ?, cover_url = ?,
        status = ?, visibility = ?, is_pinned = ?,
        published_at = CASE WHEN ? = 'PUBLISHED' THEN COALESCE(published_at, ?) ELSE NULL END, updated_at = ?
      WHERE id = ? AND class_id = ? AND status <> 'ARCHIVED'
        AND EXISTS (SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id
          WHERE c.id = posts.class_id AND ${activeClass} AND ${staffAccess})`,
    params: [input.title, input.body, input.kind, input.category, input.cover_url || null,
      input.status, input.visibility, Number(input.is_pinned), input.status, now, now, id, input.class_id, actorId],
  } : {
    sql: `INSERT INTO posts
        (id, class_id, author_id, title, body, kind, category, cover_url, status, visibility, is_pinned, published_at, created_at, updated_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM classes c
      JOIN schools school ON school.id = c.school_id
      WHERE c.id = ? AND ${activeClass} AND ${staffAccess}`,
    params: [id, actorId, input.title, input.body, input.kind, input.category, input.cover_url || null,
      input.status, input.visibility, Number(input.is_pinned), input.status === "PUBLISHED" ? now : null, now, now,
      input.class_id, actorId],
  };
  const results = await batch([statement, staffAudit(actorId, input.class_id,
    input.id ? "POST_UPDATED" : "POST_CREATED", "post", id,
    { category: input.category, status: input.status, visibility: input.visibility })]);
  if (!results[0]?.meta.changes) throw new ContentActionError("Bài viết/lớp không còn khả dụng hoặc bạn không có quyền biên tập lớp này.");
  return id;
}

export async function saveEvent(actorId: string, input: EventInput): Promise<string> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) throw new ContentActionError("Thông tin lịch lớp không hợp lệ.");
  input = parsed.data;
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const statement: D1Statement = input.id ? {
    sql: `UPDATE class_events SET title = ?, body = ?, event_date = ?, starts_at = ?,
        visibility = ?, status = ?, updated_at = ?
      WHERE id = ? AND class_id = ? AND status <> 'ARCHIVED'
        AND EXISTS (SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id
          WHERE c.id = class_events.class_id AND ${activeClass} AND ${staffAccess})`,
    params: [input.title, input.body, input.event_date, input.starts_at || null, input.visibility,
      input.status, now, id, input.class_id, actorId],
  } : {
    sql: `INSERT INTO class_events
        (id, class_id, title, body, event_date, starts_at, visibility, status, created_by, created_at, updated_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM classes c
      JOIN schools school ON school.id = c.school_id
      WHERE c.id = ? AND ${activeClass} AND ${staffAccess}`,
    params: [id, input.title, input.body, input.event_date, input.starts_at || null,
      input.visibility, input.status, actorId, now, now, input.class_id, actorId],
  };
  const results = await batch([statement, staffAudit(actorId, input.class_id,
    input.id ? "CLASS_EVENT_UPDATED" : "CLASS_EVENT_CREATED", "class_event", id,
    { event_date: input.event_date, status: input.status, visibility: input.visibility })]);
  if (!results[0]?.meta.changes) throw new ContentActionError("Lịch/lớp không còn khả dụng hoặc bạn không có quyền biên tập lớp này.");
  return id;
}

export async function saveTask(actorId: string, input: TaskInput): Promise<string> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) throw new ContentActionError("Thông tin việc cần làm không hợp lệ.");
  input = parsed.data;
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const statement: D1Statement = input.id ? {
    sql: `UPDATE class_tasks SET title = ?, details = ?, kind = ?, task_date = ?, sort_order = ?, updated_at = ?
      WHERE id = ? AND class_id = ? AND status = 'PUBLISHED'
        AND EXISTS (SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id
          WHERE c.id = class_tasks.class_id AND ${activeClass} AND ${staffAccess})`,
    params: [input.title, input.details, input.kind, input.task_date || null, input.sort_order,
      now, id, input.class_id, actorId],
  } : {
    sql: `INSERT INTO class_tasks
        (id, class_id, title, details, kind, task_date, sort_order, status, created_by, created_at, updated_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, ? FROM classes c
      JOIN schools school ON school.id = c.school_id
      WHERE c.id = ? AND ${activeClass} AND ${staffAccess}`,
    params: [id, input.title, input.details, input.kind, input.task_date || null, input.sort_order,
      actorId, now, now, input.class_id, actorId],
  };
  const results = await batch([statement, staffAudit(actorId, input.class_id,
    input.id ? "CLASS_TASK_UPDATED" : "CLASS_TASK_CREATED", "class_task", id,
    { kind: input.kind, task_date: input.task_date || null })]);
  if (!results[0]?.meta.changes) throw new ContentActionError("Việc/lớp không còn khả dụng hoặc bạn không có quyền biên tập lớp này.");
  return id;
}

export async function archiveContent(actorId: string, input: ArchiveContentInput): Promise<void> {
  const parsed = archiveContentSchema.safeParse(input);
  if (!parsed.success) throw new ContentActionError("Nội dung cần lưu trữ không hợp lệ.");
  input = parsed.data;
  // Table identifiers come only from this fixed mapping after strict enum validation.
  const tables = { post: "posts", event: "class_events", task: "class_tasks" } as const;
  const table = tables[input.type];
  const results = await batch([
    {
      sql: `UPDATE ${table} SET status = 'ARCHIVED', updated_at = ?
        WHERE id = ? AND status <> 'ARCHIVED' AND EXISTS (
          SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id
          WHERE c.id = ${table}.class_id AND ${activeClass} AND ${staffAccess}
        )`,
      params: [new Date().toISOString(), input.id, actorId],
    },
    {
      sql: `INSERT INTO audit_logs
          (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
        SELECT ?, ?, c.school_id, c.id, ?, ?, ?, '{}' FROM ${table} item
        JOIN classes c ON c.id = item.class_id JOIN schools school ON school.id = c.school_id
        WHERE changes() > 0 AND item.id = ? AND ${activeClass} AND ${staffAccess}`,
      params: [crypto.randomUUID(), actorId, "CLASS_CONTENT_ARCHIVED", input.type, input.id, input.id, actorId],
    },
  ]);
  if (!results[0]?.meta.changes) throw new ContentActionError("Nội dung đã được lưu trữ hoặc bạn không có quyền biên tập lớp này.");
}

export async function toggleStudentTask(accountId: string, sessionVersion: number, input: ToggleTaskInput): Promise<void> {
  const parsed = toggleTaskSchema.safeParse(input);
  if (!parsed.success || !validStudentIdentity(accountId, sessionVersion)) {
    throw new ContentActionError("Không thể cập nhật việc cần làm. Hãy đăng nhập lại.");
  }
  input = parsed.data;
  const calendar = getVietnamDateWindow();
  const eligibilitySql = `SELECT task.id AS task_id, c.id AS class_id, c.school_id FROM class_tasks task ${taskJoins}
    WHERE task.id = ? AND task.status = 'PUBLISHED' AND ${activeClass} AND ${studentAccess} AND ${taskWindow}`;
  const eligibilityParams = [input.task_id, accountId, sessionVersion, input.enrollment_id, calendar.today, calendar.tomorrow];
  const statement: D1Statement = input.completed ? {
    sql: `INSERT INTO student_task_completions (task_id, enrollment_id, class_id, completion_date)
      SELECT eligible.task_id, ?, eligible.class_id, ? FROM (${eligibilitySql}) eligible
      WHERE 1 ON CONFLICT(task_id, enrollment_id, completion_date) DO NOTHING`,
    params: [input.enrollment_id, calendar.today, ...eligibilityParams],
  } : {
    sql: `DELETE FROM student_task_completions WHERE task_id = ? AND enrollment_id = ? AND completion_date = ?
      AND EXISTS (${eligibilitySql})`,
    params: [input.task_id, input.enrollment_id, calendar.today, ...eligibilityParams],
  };
  const results = await batch([
    // The eligibility read, idempotent set/unset and audit all share one atomic DB.batch().
    { sql: eligibilitySql, params: eligibilityParams },
    statement,
    {
      sql: `INSERT INTO audit_logs
          (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
        SELECT ?, NULL, eligible.school_id, eligible.class_id, ?, 'class_task', ?, ?
        FROM (${eligibilitySql}) eligible WHERE changes() > 0`,
      params: [crypto.randomUUID(), input.completed ? "STUDENT_TASK_COMPLETED" : "STUDENT_TASK_UNCHECKED",
        input.task_id, JSON.stringify({ account_id: accountId, enrollment_id: input.enrollment_id, completion_date: calendar.today }),
        ...eligibilityParams],
    },
  ]);
  if (!results[0]?.results.length) {
    throw new ContentActionError("Việc này không thuộc học sinh của bạn hoặc không nằm trong danh sách hôm nay/ngày mai.");
  }
}
