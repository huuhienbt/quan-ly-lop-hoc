import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetupState } from "@/lib/config";
import { query } from "@/lib/d1";

export interface StudentLinkedProfile {
  id: string;
  full_name: string;
  display_name: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  date_of_birth: string | null;
  student_code: string | null;
  class_id: string;
  class_name: string;
  class_slug: string;
  school_name: string;
  academic_year_name: string;
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

export async function getCurrentStudentAccount(): Promise<StudentAccountSession | null> {
  if (!getSetupState().sessionReady) return null;
  const session = await getServerSession(authOptions);
  const identity = session?.user;
  if (identity?.kind !== "student" || !identity.studentAccountId ||
    !Number.isSafeInteger(identity.studentSessionVersion)) return null;
  const account = (await query<{ id: string; phone: string; must_change_password: number; session_version: number }>(
    `SELECT id, phone, must_change_password, session_version FROM student_accounts
     WHERE id = ? AND status = 'ACTIVE' AND session_version = ?`,
    [identity.studentAccountId, identity.studentSessionVersion!],
  ))[0];
  if (!account) return null;
  // Default-password sessions reach the password-change page without receiving pupil records.
  const students = account.must_change_password ? [] : await query<StudentLinkedProfile>(
    `SELECT s.id, s.full_name, s.display_name, s.gender, s.date_of_birth, s.student_code,
      c.id AS class_id, c.name AS class_name, c.slug AS class_slug,
      school.name AS school_name, y.name AS academic_year_name
     FROM student_account_students link
     JOIN student_accounts login ON login.id = link.account_id AND login.status = 'ACTIVE'
       AND login.session_version = ? AND login.must_change_password = 0
     JOIN students s ON s.id = link.student_id AND s.archived_at IS NULL
     JOIN student_enrollments e ON e.student_id = s.id AND e.school_id = s.school_id AND e.status = 'ACTIVE'
     JOIN classes c ON c.id = e.class_id AND c.archived_at IS NULL
     JOIN schools school ON school.id = s.school_id AND school.archived_at IS NULL
     JOIN academic_years y ON y.id = c.academic_year_id
     WHERE link.account_id = ? ORDER BY y.starts_on DESC, c.name, s.full_name, s.id`, [account.session_version, account.id],
  );
  return { ...account, must_change_password: account.must_change_password === 1, students };
}

export async function requireStudentAccount(
  { allowPasswordChange = false }: { allowPasswordChange?: boolean } = {},
): Promise<StudentAccountSession> {
  const account = await getCurrentStudentAccount();
  if (!account) throw new StudentAuthorizationError(401, "UNAUTHENTICATED");
  if (account.must_change_password && !allowPasswordChange) {
    throw new StudentAuthorizationError(403, "PASSWORD_CHANGE_REQUIRED");
  }
  return account;
}
