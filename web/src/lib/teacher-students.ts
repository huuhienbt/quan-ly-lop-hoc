import "server-only";

import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { batch, query } from "@/lib/d1";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isPredictableStudentPassword, STUDENT_BULK_RESET_HOURS, STUDENT_BULK_RESET_LIMIT } from "@/lib/student-reset-options";

export interface TeacherStudentRow {
  enrollment_id: string;
  student_number: number | null;
  full_name: string;
  account_id: string | null;
  phone: string | null;
  account_status: "ACTIVE" | "SUSPENDED" | null;
  must_change_password: number | null;
  temporary_password_expired: number;
  session_version: number | null;
  can_reset: number;
}

export interface ResetStudentInput {
  class_id: string;
  enrollment_id: string;
  account_id: string;
  session_version: number;
}

export type BulkResetTarget = Omit<ResetStudentInput, "class_id">;
export interface BulkResetEntry {
  names: string[];
  phone: string;
  temporaryPassword: string;
}
export interface BulkResetReceipt {
  expiresAt: string;
  accounts: BulkResetEntry[];
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
      CASE WHEN login.temporary_password_expires_at <= ? THEN 1 ELSE 0 END AS temporary_password_expired,
      CASE WHEN login.status = 'ACTIVE' AND ${accountScope} THEN 1 ELSE 0 END AS can_reset
    ${rosterFrom}
    ${actorJoin}
    LEFT JOIN student_account_students link ON link.student_id = pupil.id
    LEFT JOIN student_accounts login ON login.id = link.account_id
    WHERE classroom.id = ? AND enrollment.status = 'ACTIVE' AND ${assignedStaff}
    ORDER BY enrollment.student_number IS NULL, enrollment.student_number, pupil.full_name, enrollment.id`,
  [new Date().toISOString(), actorId, classId]);
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
      sql: `UPDATE student_accounts AS login SET password_hash = ?, must_change_password = 1, temporary_password_expires_at = NULL,
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

const staleSelection = "Danh sách hoặc quyền quản lý đã thay đổi. Thầy cô hãy tải lại trang và chọn lại các tài khoản.";

function drawTemporaryPin(used: Set<string>, phone: string): string {
  let pin: string;
  do { pin = String(randomInt(100_000_000)).padStart(8, "0"); }
  while (isPredictableStudentPassword(pin) || phone.endsWith(pin) || used.has(pin));
  used.add(pin);
  return pin;
}

export function resetTeacherStudentPasswords(actorId: string, classId: string, targets: BulkResetTarget[]): Promise<BulkResetReceipt> {
  return issueTeacherStudentPasswords(actorId, classId, targets);
}

export async function setTeacherStudentPassword(actorId: string, input: ResetStudentInput, temporaryPassword: string): Promise<BulkResetReceipt> {
  if (typeof temporaryPassword !== "string" || temporaryPassword.length !== 8 || !/^[0-9]{8}$/.test(temporaryPassword)) {
    throw new TeacherStudentError("Mật khẩu tạm phải gồm đúng 8 chữ số.");
  }
  return issueTeacherStudentPasswords(actorId, input.class_id, [input], temporaryPassword);
}

async function checkChosenPin(pin: string, phone: string, target: BulkResetTarget): Promise<void> {
  const looksLikeBirthDate = /^(0[1-9]|[12][0-9]|3[01])(0[1-9]|1[0-2])(19|20)[0-9]{2}$/.test(pin) ||
    /^(19|20)[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$/.test(pin);
  if (isPredictableStudentPassword(pin) || looksLikeBirthDate || phone.includes(pin)) {
    throw new TeacherStudentError("Hãy chọn mã khác. Không dùng ngày sinh, dãy số dễ đoán hoặc một phần số điện thoại đăng nhập.");
  }
  const [previous] = await query<{ password_hash: string }>(
    "SELECT password_hash FROM student_accounts WHERE id = ? AND phone = ? AND session_version = ? AND status = 'ACTIVE'",
    [target.account_id, phone, target.session_version],
  );
  if (!previous) throw new TeacherStudentError(staleSelection);
  if (await verifyPassword(pin, previous.password_hash)) {
    throw new TeacherStudentError("Mật khẩu tạm mới phải khác mật khẩu đang dùng của tài khoản này.");
  }
}

async function issueTeacherStudentPasswords(
  actorId: string, classId: string, targets: BulkResetTarget[], chosenPin?: string,
): Promise<BulkResetReceipt> {
  if (targets.length < 1 || targets.length > STUDENT_BULK_RESET_LIMIT ||
    new Set(targets.map(item => item.account_id)).size !== targets.length) {
    throw new TeacherStudentError("Số tài khoản đã chọn không hợp lệ.");
  }

  const roster = await getTeacherStudentRoster(actorId, classId);
  const byEnrollment = new Map(roster.map(row => [row.enrollment_id, row]));
  const namesByAccount = new Map<string, string[]>();
  for (const row of roster) {
    if (!row.account_id) continue;
    const names = namesByAccount.get(row.account_id);
    if (names) names.push(row.full_name);
    else namesByAccount.set(row.account_id, [row.full_name]);
  }
  const recipients = targets.map(target => {
    const row = byEnrollment.get(target.enrollment_id);
    if (!row?.phone || row.can_reset !== 1 || row.account_id !== target.account_id ||
      row.session_version !== target.session_version) throw new TeacherStudentError(staleSelection);
    return { names: namesByAccount.get(target.account_id)!, phone: row.phone };
  });

  if (chosenPin !== undefined) await checkChosenPin(chosenPin, recipients[0].phone, targets[0]);
  const used = new Set<string>();
  const accounts = recipients.map(row => ({ ...row, temporaryPassword: chosenPin ?? drawTemporaryPin(used, row.phone) }));
  const hashes: string[] = [];
  // Keep the password hashing workload bounded when a whole class is selected.
  for (let start = 0; start < accounts.length; start += 4) {
    hashes.push(...await Promise.all(accounts.slice(start, start + 4).map(row => hashPassword(row.temporaryPassword))));
  }
  const payload = JSON.stringify(targets.map(({ account_id, enrollment_id, session_version }, i) => ({
    account_id, enrollment_id, session_version, phone: accounts[i].phone, password_hash: hashes[i], audit_id: randomUUID(),
  })));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + STUDENT_BULK_RESET_HOURS * 60 * 60 * 1000).toISOString();
  const [write, audit] = await batch([
    {
      // Materialize the authorized set before updating. If a single target has changed,
      // the count guard prevents every write, including writes to the other targets.
      sql: `WITH requested AS (
          SELECT json_extract(value, '$.account_id') AS account_id,
            json_extract(value, '$.enrollment_id') AS enrollment_id,
            json_extract(value, '$.session_version') AS session_version,
            json_extract(value, '$.phone') AS phone,
            json_extract(value, '$.password_hash') AS password_hash
          FROM json_each(?)
        ), eligible AS MATERIALIZED (
          SELECT login.id AS account_id, job.password_hash
          ${rosterFrom}
          ${actorJoin}
          JOIN requested job ON job.enrollment_id = enrollment.id
          JOIN student_account_students link ON link.student_id = pupil.id AND link.account_id = job.account_id
          JOIN student_accounts login ON login.id = link.account_id AND login.status = 'ACTIVE'
            AND login.session_version = job.session_version AND login.phone = job.phone
          WHERE classroom.id = ? AND enrollment.status = 'ACTIVE' AND ${assignedStaff} AND ${accountScope}
        )
        UPDATE student_accounts AS current
        SET password_hash = eligible.password_hash, must_change_password = 1, temporary_password_expires_at = ?,
            session_version = current.session_version + 1, failed_attempts = 0, failure_window_started_at = NULL,
            locked_until = NULL, updated_at = ?
        FROM eligible
        WHERE current.id = eligible.account_id AND (SELECT count(*) FROM eligible) = ?`,
      params: [payload, actorId, classId, expiresAt, now.toISOString(), targets.length],
    },
    {
      sql: `INSERT INTO audit_logs (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
        SELECT json_extract(job.value, '$.audit_id'), ?, classroom.school_id, classroom.id,
          ?, 'student_account', json_extract(job.value, '$.account_id'),
          json_object('expires_at', ?)
        FROM classes classroom CROSS JOIN json_each(?) job
        WHERE classroom.id = ? AND changes() = ?`,
      params: [actorId, chosenPin === undefined ? "STUDENT_PASSWORD_BULK_RESET" : "STUDENT_PASSWORD_MANUAL_SET",
        expiresAt, payload, classId, targets.length],
    },
  ]);
  if (write.meta.changes !== targets.length || audit.meta.changes !== targets.length) {
    throw new TeacherStudentError(staleSelection);
  }
  return { expiresAt, accounts };
}
