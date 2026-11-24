import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetupState } from "@/lib/config";
import { query } from "@/lib/d1";
import { AVATAR_KEY_PREFIX } from "@/lib/student-profile-options";

export interface StudentLinkedProfile {
  id: string;
  full_name: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  date_of_birth: string | null;
  student_code: string | null;
  enrollment_id: string;
  class_id: string;
  class_name: string;
  class_slug: string;
  school_name: string;
  academic_year_name: string;
  profile_updated_at?: string;
  has_avatar?: number;
}

export interface StudentAccountSession {
  id: string;
  phone: string;
  must_change_password: boolean;
  session_version: number;
  students: StudentLinkedProfile[];
}

export class StudentAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403, public readonly code: "UNAUTHENTICATED" | "PASSWORD_CHANGE_REQUIRED") {
    super(code === "PASSWORD_CHANGE_REQUIRED" ? "Bạn cần đổi mật khẩu trước khi tiếp tục." : "Bạn cần đăng nhập tài khoản học sinh.");
    this.name = "StudentAuthorizationError";
  }
}

export interface StudentRequestIdentity {
  accountId: string;
  sessionVersion: number;
}

// Resolve the signed student identity before reading authorized pupil records.
export async function getStudentRequestIdentity(): Promise<StudentRequestIdentity | null> {
  if (!getSetupState().sessionReady) return null;
  const session = await getServerSession(authOptions);
  const identity = session?.user;
  if (identity?.kind !== "student" || typeof identity.studentAccountId !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(identity.studentAccountId) ||
    !Number.isSafeInteger(identity.studentSessionVersion) || identity.studentSessionVersion! < 1) return null;
  return { accountId: identity.studentAccountId, sessionVersion: identity.studentSessionVersion! };
}

export async function getCurrentStudentAccount({ includeProfileEditor = false }: { includeProfileEditor?: boolean } = {}): Promise<StudentAccountSession | null> {
  const identity = await getStudentRequestIdentity();
  if (!identity) return null;
  // One database read validates the live account and selects only its active
  // enrollments. A LEFT JOIN preserves valid accounts with no linked pupils
  // (including password-change sessions); those rows carry no pupil data.
  type AccountRow = Omit<StudentLinkedProfile, "id"> & {
    id: string | null; account_id: string; phone: string; must_change_password: number;
    session_version: number; year_starts_on: string | null;
  };
  const rows = await query<AccountRow>(
    `WITH account AS (
       SELECT id, phone, must_change_password, session_version FROM student_accounts
       WHERE id = ? AND status = 'ACTIVE' AND session_version = ?
         AND (temporary_password_expires_at IS NULL OR temporary_password_expires_at > ?)
     ), linked_profiles AS (
       SELECT s.id, s.full_name, s.gender, s.date_of_birth, s.student_code, e.id AS enrollment_id,
         c.id AS class_id, c.name AS class_name, c.slug AS class_slug,
         school.name AS school_name, y.name AS academic_year_name, y.starts_on AS year_starts_on
         ${includeProfileEditor ? `, s.updated_at AS profile_updated_at,
           CASE WHEN instr(s.avatar_key, '${AVATAR_KEY_PREFIX}') = 1 THEN 1 ELSE 0 END AS has_avatar` : ""}
       FROM account login
       JOIN student_account_students link ON link.account_id = login.id
       JOIN students s ON s.id = link.student_id AND s.archived_at IS NULL
       JOIN student_enrollments e ON e.student_id = s.id AND e.school_id = s.school_id AND e.status = 'ACTIVE'
       JOIN classes c ON c.id = e.class_id AND c.school_id = e.school_id
         AND c.academic_year_id = e.academic_year_id AND c.archived_at IS NULL
       JOIN schools school ON school.id = s.school_id AND school.archived_at IS NULL
       JOIN academic_years y ON y.id = c.academic_year_id
       WHERE login.must_change_password = 0
     )
     SELECT login.id AS account_id, login.phone, login.must_change_password, login.session_version, profile.*
     FROM account login LEFT JOIN linked_profiles profile ON 1
     ORDER BY profile.year_starts_on DESC, profile.class_name, profile.full_name, profile.enrollment_id`,
    [identity.accountId, identity.sessionVersion, new Date().toISOString()],
  );
  const account = rows[0];
  if (!account) return null;
  const students: StudentLinkedProfile[] = rows.flatMap(row => row.id ? [{
    id: row.id, full_name: row.full_name, gender: row.gender, date_of_birth: row.date_of_birth,
    student_code: row.student_code, enrollment_id: row.enrollment_id,
    class_id: row.class_id, class_name: row.class_name, class_slug: row.class_slug,
    school_name: row.school_name, academic_year_name: row.academic_year_name,
    ...(includeProfileEditor ? { profile_updated_at: row.profile_updated_at, has_avatar: row.has_avatar } : {}),
  }] : []);
  return { id: account.account_id, phone: account.phone, session_version: account.session_version,
    must_change_password: account.must_change_password === 1, students };
}

export async function requireStudentAccount(
  { allowPasswordChange = false, includeProfileEditor = false }: { allowPasswordChange?: boolean; includeProfileEditor?: boolean } = {},
): Promise<StudentAccountSession> {
  const account = await getCurrentStudentAccount({ includeProfileEditor });
  if (!account) throw new StudentAuthorizationError(401, "UNAUTHENTICATED");
  if (account.must_change_password && !allowPasswordChange) {
    throw new StudentAuthorizationError(403, "PASSWORD_CHANGE_REQUIRED");
  }
  return account;
}
