import "server-only";

import { z } from "zod";
import { batch, query } from "@/lib/d1";
import { requireSuperAdmin } from "@/lib/rbac";

const SCHOOL_ID = "school-ben-tre";

export interface ActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface School {
  id: string;
  name: string;
}

export interface TeacherRequest {
  id: string;
  user_id: string;
  name: string;
  email: string;
  note: string | null;
  created_at: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: number;
}

export interface AdminClass {
  id: string;
  name: string;
  slug: string;
  grade: number;
  academic_year_id: string;
  academic_year_name: string;
  visibility: "PRIVATE" | "PUBLIC";
  teacher_id: string | null;
  teacher_name: string | null;
  teacher_email: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "PENDING" | "TEACHER" | "SUPER_ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  created_at: string;
}

export interface AdminOverview {
  school: School;
  requests: TeacherRequest[];
  teachers: Teacher[];
  classes: AdminClass[];
  years: AcademicYear[];
  users: AdminUser[];
}

const id = z.string().trim().min(1, "Thiếu mã định danh.")
  .max(100, "Mã định danh quá dài.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Mã định danh không hợp lệ.");
const name = z.string().trim().min(1, "Vui lòng nhập tên.")
  .max(100, "Tên không được quá 100 ký tự.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Ngày không tồn tại.");

export const adminSchemas = {
  approval: z.object({
    request_id: id,
    review_note: z.string().trim().max(500, "Ghi chú không được quá 500 ký tự.").optional(),
  }).strict(),
  year: z.object({
    name,
    starts_on: date,
    ends_on: date,
    is_current: z.enum(["on"]).optional().transform((value) => value === "on"),
  }).strict().refine((value) => value.starts_on < value.ends_on, {
    message: "Ngày kết thúc phải sau ngày bắt đầu.",
    path: ["ends_on"],
  }),
  class: z.object({
    name,
    slug: z.string().trim().toLowerCase().min(3, "Đường dẫn cần ít nhất 3 ký tự.")
      .max(100, "Đường dẫn không được quá 100 ký tự.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Đường dẫn chỉ gồm chữ không dấu, số và dấu gạch nối."),
    grade: z.coerce.number().int("Khối phải là số nguyên.").min(1, "Khối từ 1 đến 5.").max(5, "Khối từ 1 đến 5."),
    academic_year_id: id,
    greeting: z.string().trim().max(1000, "Lời chào không được quá 1.000 ký tự.").optional(),
  }).strict(),
  assignment: z.object({ class_id: id, user_id: id }).strict(),
  userStatus: z.object({ user_id: id, status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict(),
};

export class AdminActionError extends Error {}

// These predicates are static SQL. All client values are bound parameters.
// Rechecking the actor inside each write also closes the gap after the session check.
const actorIsAdmin = "EXISTS (SELECT 1 FROM users actor WHERE actor.id = ? AND actor.role = 'SUPER_ADMIN' AND actor.status = 'ACTIVE')";
const teacherIsEligible = `EXISTS (
  SELECT 1 FROM users teacher
  JOIN teacher_requests approved ON approved.user_id = teacher.id
  WHERE teacher.id = ? AND teacher.role = 'TEACHER' AND teacher.status = 'ACTIVE'
    AND approved.school_id = ? AND approved.status = 'APPROVED'
)`;

function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>,
  classId: string | null = null,
) {
  return {
    sql: `INSERT INTO audit_logs
      (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
    params: [crypto.randomUUID(), actorId, SCHOOL_ID, classId, action, entityType, entityId, JSON.stringify(details)],
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireSuperAdmin();
  const [schools, requests, teachers, classes, years, users] = await Promise.all([
    query<School>("SELECT id, name FROM schools WHERE id = ? AND archived_at IS NULL", [SCHOOL_ID]),
    query<TeacherRequest>(`SELECT r.id, r.user_id, u.name, u.email, r.note, r.created_at
      FROM teacher_requests r JOIN users u ON u.id = r.user_id
      WHERE r.school_id = ? AND r.status = 'PENDING' AND u.role = 'PENDING' AND u.status = 'ACTIVE'
      ORDER BY r.created_at, r.id`, [SCHOOL_ID]),
    query<Teacher>(`SELECT u.id, u.name, u.email FROM users u
      JOIN teacher_requests r ON r.user_id = u.id
      WHERE r.school_id = ? AND r.status = 'APPROVED' AND u.role = 'TEACHER' AND u.status = 'ACTIVE'
      ORDER BY u.name, u.id`, [SCHOOL_ID]),
    query<AdminClass>(`SELECT c.id, c.name, c.slug, c.grade, c.academic_year_id,
        y.name AS academic_year_name, c.visibility,
        t.user_id AS teacher_id, u.name AS teacher_name, u.email AS teacher_email
      FROM classes c JOIN academic_years y ON y.id = c.academic_year_id AND y.school_id = c.school_id
      LEFT JOIN class_teachers t ON t.class_id = c.id AND t.is_homeroom = 1 AND t.ended_at IS NULL
      LEFT JOIN users u ON u.id = t.user_id
      WHERE c.school_id = ? AND c.archived_at IS NULL
      ORDER BY y.starts_on DESC, c.grade, c.name, c.id`, [SCHOOL_ID]),
    query<AcademicYear>(`SELECT id, name, starts_on, ends_on, is_current FROM academic_years
      WHERE school_id = ? ORDER BY starts_on DESC, id`, [SCHOOL_ID]),
    query<AdminUser>(`SELECT id, name, email, role, status, created_at FROM users
      ORDER BY CASE role WHEN 'SUPER_ADMIN' THEN 0 WHEN 'TEACHER' THEN 1 ELSE 2 END, name, id`),
  ]);
  if (!schools[0]) throw new AdminActionError("Chưa có thông tin Trường Tiểu học Bến Tre trong D1.");
  return { school: schools[0], requests, teachers, classes, years, users };
}

type ApprovalInput = z.output<typeof adminSchemas.approval>;

export async function reviewTeacherRequest(
  actorId: string,
  input: ApprovalInput,
  decision: "APPROVED" | "REJECTED",
): Promise<void> {
  const timestamp = new Date().toISOString();
  const statements = [];
  if (decision === "APPROVED") {
    statements.push({
      sql: `UPDATE users SET role = 'TEACHER', updated_at = ?
        WHERE role = 'PENDING' AND status = 'ACTIVE'
          AND id = (SELECT user_id FROM teacher_requests WHERE id = ? AND school_id = ? AND status = 'PENDING')
          AND ${actorIsAdmin}`,
      params: [timestamp, input.request_id, SCHOOL_ID, actorId],
    });
  }
  statements.push({
    sql: `UPDATE teacher_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ?, updated_at = ?
      WHERE id = ? AND school_id = ? AND status = 'PENDING'
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = teacher_requests.user_id
          AND u.role = ? AND u.status = 'ACTIVE')
        ${decision === "APPROVED" ? "AND changes() > 0" : ""}
        AND ${actorIsAdmin}`,
    params: [decision, actorId, timestamp, input.review_note || null, timestamp,
      input.request_id, SCHOOL_ID, decision === "APPROVED" ? "TEACHER" : "PENDING", actorId],
  });
  statements.push(audit(actorId, decision === "APPROVED" ? "TEACHER_APPROVED" : "TEACHER_REJECTED",
    "teacher_request", input.request_id, { review_note: input.review_note || null }));
  const result = await batch(statements);
  if (!result[result.length - 2]?.meta.changes) {
    throw new AdminActionError("Yêu cầu đã được xử lý hoặc tài khoản không còn đủ điều kiện. Hãy tải lại trang.");
  }
}

export async function addAcademicYear(actorId: string, input: z.output<typeof adminSchemas.year>): Promise<void> {
  const yearId = crypto.randomUUID();
  const statements = [];
  if (input.is_current) {
    statements.push({
      sql: `UPDATE academic_years SET is_current = 0 WHERE school_id = ? AND is_current = 1
        AND EXISTS (SELECT 1 FROM schools WHERE id = academic_years.school_id AND archived_at IS NULL)
        AND ${actorIsAdmin}`,
      params: [SCHOOL_ID, actorId],
    });
  }
  statements.push({
    sql: `INSERT INTO academic_years (id, school_id, name, starts_on, ends_on, is_current)
      SELECT ?, id, ?, ?, ?, ? FROM schools
      WHERE id = ? AND archived_at IS NULL AND ${actorIsAdmin}`,
    params: [yearId, input.name, input.starts_on, input.ends_on, Number(input.is_current), SCHOOL_ID, actorId],
  });
  statements.push(audit(actorId, "ACADEMIC_YEAR_CREATED", "academic_year", yearId,
    { name: input.name, is_current: input.is_current }));
  const results = await batch(statements);
  if (!results[results.length - 2]?.meta.changes) throw new AdminActionError("Không thể tạo năm học cho trường này.");
}

export async function addClass(actorId: string, input: z.output<typeof adminSchemas.class>): Promise<void> {
  const classId = crypto.randomUUID();
  const results = await batch([
    {
      sql: `INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, greeting, visibility, created_by)
        SELECT ?, y.school_id, y.id, ?, ?, ?, ?, 'PRIVATE', ?
        FROM academic_years y JOIN schools s ON s.id = y.school_id
        WHERE y.id = ? AND y.school_id = ? AND s.archived_at IS NULL AND ${actorIsAdmin}`,
      params: [classId, input.name, input.slug, input.grade, input.greeting || null,
        actorId, input.academic_year_id, SCHOOL_ID, actorId],
    },
    audit(actorId, "CLASS_CREATED", "class", classId,
      { name: input.name, slug: input.slug, academic_year_id: input.academic_year_id }, classId),
  ]);
  if (!results[0]?.meta.changes) throw new AdminActionError("Năm học không thuộc trường này hoặc không còn khả dụng.");
}

type AssignmentInput = z.output<typeof adminSchemas.assignment>;

export async function setHomeroomTeacher(actorId: string, input: AssignmentInput): Promise<void> {
  const timestamp = new Date().toISOString();
  const results = await batch([
    {
      sql: `UPDATE class_teachers SET ended_at = ?
        WHERE class_id = ? AND is_homeroom = 1 AND ended_at IS NULL
          AND EXISTS (SELECT 1 FROM classes WHERE id = ? AND school_id = ? AND archived_at IS NULL)
          AND ${teacherIsEligible} AND ${actorIsAdmin}`,
      params: [timestamp, input.class_id, input.class_id, SCHOOL_ID, input.user_id, SCHOOL_ID, actorId],
    },
    {
      sql: `INSERT INTO class_teachers (class_id, user_id, is_homeroom, assigned_by, assigned_at, ended_at)
        SELECT c.id, ?, 1, ?, ?, NULL FROM classes c
        WHERE c.id = ? AND c.school_id = ? AND c.archived_at IS NULL
          AND ${teacherIsEligible} AND ${actorIsAdmin}
        ON CONFLICT(class_id, user_id) DO UPDATE SET
          is_homeroom = 1, assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at, ended_at = NULL`,
      params: [input.user_id, actorId, timestamp, input.class_id, SCHOOL_ID, input.user_id, SCHOOL_ID, actorId],
    },
    audit(actorId, "HOMEROOM_TEACHER_ASSIGNED", "class", input.class_id,
      { teacher_user_id: input.user_id }, input.class_id),
  ]);
  if (!results[1]?.meta.changes) {
    throw new AdminActionError("Lớp không còn khả dụng hoặc giáo viên chưa được duyệt/đang bị tạm khóa.");
  }
}

export async function endHomeroomTeacher(actorId: string, input: AssignmentInput): Promise<void> {
  const results = await batch([
    {
      sql: `UPDATE class_teachers SET ended_at = ?
        WHERE class_id = ? AND user_id = ? AND is_homeroom = 1 AND ended_at IS NULL
          AND EXISTS (SELECT 1 FROM classes WHERE id = ? AND school_id = ?)
          AND ${actorIsAdmin}`,
      params: [new Date().toISOString(), input.class_id, input.user_id, input.class_id, SCHOOL_ID, actorId],
    },
    audit(actorId, "HOMEROOM_TEACHER_ENDED", "class", input.class_id,
      { teacher_user_id: input.user_id }, input.class_id),
  ]);
  if (!results[0]?.meta.changes) throw new AdminActionError("Phân công này không còn hiệu lực. Hãy tải lại trang.");
}

export async function changeUserStatus(actorId: string, input: z.output<typeof adminSchemas.userStatus>): Promise<void> {
  const results = await batch([
    {
      sql: `UPDATE users SET status = ?, updated_at = ?
        WHERE id = ? AND id <> ? AND role <> 'SUPER_ADMIN' AND status <> ? AND ${actorIsAdmin}`,
      params: [input.status, new Date().toISOString(), input.user_id, actorId, input.status, actorId],
    },
    audit(actorId, input.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
      "user", input.user_id, { status: input.status }),
  ]);
  if (!results[0]?.meta.changes) {
    throw new AdminActionError("Tài khoản đã ở trạng thái này hoặc không thể thay đổi tài khoản Super Admin.");
  }
}
