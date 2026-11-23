import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { batch, query } from "@/lib/d1";
import { hashPassword } from "@/lib/password";

export interface TeacherStudentRow {
  enrollment_id: string;
  student_number: number | null;
  full_name: string;
  account_id: string | null;
  phone: string | null;
  account_status: "ACTIVE" | "SUSPENDED" | null;
  must_change_password: number | null;
  session_version: number | null;
  can_reset: number;
}

export interface ResetStudentInput {
  class_id: string;
  enrollment_id: string;
  account_id: string;
  session_version: number;
}

export class TeacherStudentError extends Error {}

const rosterFrom = `FROM student_enrollments enrollment
  JOIN students pupil ON pupil.id = enrollment.student_id AND pupil.school_id = enrollment.school_id
    AND pupil.archived_at IS NULL
  JOIN classes classroom ON classroom.id = enrollment.class_id AND classroom.school_id = enrollment.school_id
    AND classroom.academic_year_id = enrollment.academic_year_id AND classroom.archived_at IS NULL
  JOIN schools school ON school.id = classroom.school_id AND school.archived_at IS NULL`;

const actorJoin = `JOIN users actor ON actor.id = ? AND actor.status = 'ACTIVE'
  AND actor.email_verified_at IS NOT NULL`;
const assignedStaff = `(actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER' AND EXISTS (
  SELECT 1 FROM class_teachers assignment
  WHERE assignment.class_id = classroom.id AND assignment.user_id = actor.id AND assignment.ended_at IS NULL
)))`;

// A password belongs to the whole phone account. Teachers cannot change the
// password for a family that also has a pupil in another active class.
const accountScope = `(actor.role = 'SUPER_ADMIN' OR NOT EXISTS (
  SELECT 1 FROM student_account_students family
  JOIN students sibling ON sibling.id = family.student_id AND sibling.archived_at IS NULL
  JOIN student_enrollments other ON other.student_id = sibling.id AND other.school_id = sibling.school_id
    AND other.status = 'ACTIVE'
  JOIN classes other_class ON other_class.id = other.class_id AND other_class.school_id = other.school_id
    AND other_class.academic_year_id = other.academic_year_id AND other_class.archived_at IS NULL
  JOIN schools other_school ON other_school.id = other.school_id AND other_school.archived_at IS NULL
  WHERE family.account_id = login.id AND other.class_id <> classroom.id
))`;

export function getTeacherStudentRoster(actorId: string, classId: string): Promise<TeacherStudentRow[]> {
  return query<TeacherStudentRow>(`SELECT enrollment.id AS enrollment_id, enrollment.student_number,
      pupil.full_name, login.id AS account_id, login.phone, login.status AS account_status,
      login.must_change_password, login.session_version,
      CASE WHEN login.status = 'ACTIVE' AND ${accountScope} THEN 1 ELSE 0 END AS can_reset
    ${rosterFrom}
    ${actorJoin}
    LEFT JOIN student_account_students link ON link.student_id = pupil.id
    LEFT JOIN student_accounts login ON login.id = link.account_id
    WHERE classroom.id = ? AND enrollment.status = 'ACTIVE' AND ${assignedStaff}
    ORDER BY enrollment.student_number IS NULL, enrollment.student_number, pupil.full_name, enrollment.id`,
  [actorId, classId]);
}

function makeTemporaryPassword() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 characters; no ambiguous 0/O or 1/I.
  const groups = ["", "", "", ""];
  randomBytes(16).forEach((byte, index) => { groups[Math.floor(index / 4)] += alphabet[byte % alphabet.length]; });
  return groups.join("-");
}

export async function resetTeacherStudentPassword(actorId: string, input: ResetStudentInput): Promise<string> {
  const password = makeTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const [write] = await batch([
    {
      sql: `UPDATE student_accounts AS login SET password_hash = ?, must_change_password = 1,
          session_version = session_version + 1, failed_attempts = 0,
          failure_window_started_at = NULL, locked_until = NULL, updated_at = ?
        WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE' AND EXISTS (
          SELECT 1 ${rosterFrom}
          ${actorJoin}
          JOIN student_account_students link ON link.student_id = pupil.id AND link.account_id = login.id
          WHERE classroom.id = ? AND enrollment.id = ? AND enrollment.status = 'ACTIVE'
            AND ${assignedStaff} AND ${accountScope}
        )`,
      params: [passwordHash, now, input.account_id, input.session_version, actorId, input.class_id, input.enrollment_id],
    },
    {
      sql: `INSERT INTO audit_logs (id, actor_user_id, school_id, class_id, action, entity_type, entity_id)
        SELECT ?, ?, school_id, id, 'STUDENT_PASSWORD_RESET', 'student_account', ?
        FROM classes WHERE id = ? AND changes() = 1`,
      params: [randomUUID(), actorId, input.account_id, input.class_id],
    },
  ]);
  if (write.meta.changes !== 1) {
    throw new TeacherStudentError("Không cấp lại được mật khẩu. Tài khoản có thể đã thay đổi hoặc không thuộc quyền quản lý. Thầy cô hãy tải lại danh sách.");
  }
  return password;
}
