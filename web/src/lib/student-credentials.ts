import "server-only";
import { randomBytes } from "node:crypto";
import { query } from "@/lib/d1";
import { hashPassword, verifyPassword } from "@/lib/password";

export const DEFAULT_STUDENT_PASSWORD = "123456789";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export interface StudentCredentialUser {
  id: string;
  kind: "student";
  studentAccountId: string;
  studentSessionVersion: number;
}

const issuedStudentUsers = new WeakMap<object, { id: string; version: number }>();

export function isAuthorizedStudentCredentialUser(user: unknown): user is StudentCredentialUser {
  if (!user || typeof user !== "object") return false;
  const issued = issuedStudentUsers.get(user);
  const candidate = user as Partial<StudentCredentialUser>;
  return Boolean(issued && candidate.kind === "student" && candidate.id === issued.id &&
    candidate.studentAccountId === issued.id && candidate.studentSessionVersion === issued.version);
}

export class StudentCredentialError extends Error {
  constructor(message = "Không thể đổi mật khẩu. Hãy kiểm tra mật khẩu hiện tại hoặc thử lại sau.") {
    super(message);
    this.name = "StudentCredentialError";
  }
}

interface ReservedAccount {
  id: string;
  password_hash: string;
  session_version: number;
  failed_attempts: number;
  failure_window_started_at: string;
}

export function normalizeVietnamPhone(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 40) return null;
  let phone = input.trim().replace(/[\s().-]/g, "");
  if (phone.startsWith("+84")) phone = `0${phone.slice(3)}`;
  return /^0[35789]\d{8}$/.test(phone) ? phone : null;
}

let dummyHash: Promise<string> | undefined;
async function verifyDummy(password: string) {
  dummyHash ??= hashPassword(randomBytes(32).toString("hex"));
  await verifyPassword(password, await dummyHash);
}

async function reserveAttempt(
  identity: { phone: string } | { accountId: string; sessionVersion: number },
): Promise<ReservedAccount | undefined> {
  const now = new Date();
  const timestamp = now.toISOString();
  const cutoff = new Date(now.getTime() - WINDOW_MS).toISOString();
  const lockedUntil = new Date(now.getTime() + WINDOW_MS).toISOString();
  const byPhone = "phone" in identity;
  const rows = await query<ReservedAccount>(
    `UPDATE student_accounts SET
      failed_attempts = CASE WHEN failure_window_started_at IS NULL OR failure_window_started_at <= ?
        THEN 1 ELSE failed_attempts + 1 END,
      failure_window_started_at = CASE WHEN failure_window_started_at IS NULL OR failure_window_started_at <= ?
        THEN ? ELSE failure_window_started_at END,
      locked_until = CASE WHEN (CASE WHEN failure_window_started_at IS NULL OR failure_window_started_at <= ?
        THEN 1 ELSE failed_attempts + 1 END) >= ? THEN ? ELSE NULL END,
      updated_at = ?
     WHERE ${byPhone ? "phone = ?" : "id = ? AND session_version = ?"}
       AND status = 'ACTIVE' AND (locked_until IS NULL OR locked_until <= ?)
       AND (failure_window_started_at IS NULL OR failure_window_started_at <= ? OR failed_attempts < ?)
     RETURNING id, password_hash, session_version, failed_attempts, failure_window_started_at`,
    [cutoff, cutoff, timestamp, cutoff, MAX_ATTEMPTS, lockedUntil, timestamp,
      ...(byPhone ? [identity.phone] : [identity.accountId, identity.sessionVersion]),
      timestamp, cutoff, MAX_ATTEMPTS],
  );
  return rows[0];
}

export async function authorizeStudentCredentials(
  credentials?: { phone?: unknown; password?: unknown },
): Promise<StudentCredentialUser | null> {
  const phone = normalizeVietnamPhone(credentials?.phone);
  const password = credentials?.password;
  if (!phone || typeof password !== "string" || !password.length || password.length > 128) return null;
  try {
    // The atomic reservation bounds expensive password checks even during parallel requests.
    const account = await reserveAttempt({ phone });
    if (!account) { await verifyDummy(password); return null; }
    if (!await verifyPassword(password, account.password_hash)) return null;
    const now = new Date().toISOString();
    const current = (await query<{ id: string; session_version: number }>(
      `UPDATE student_accounts SET
        failed_attempts = CASE WHEN failed_attempts = ? AND failure_window_started_at = ? THEN 0 ELSE failed_attempts END,
        failure_window_started_at = CASE WHEN failed_attempts = ? AND failure_window_started_at = ? THEN NULL ELSE failure_window_started_at END,
        locked_until = CASE WHEN failed_attempts = ? AND failure_window_started_at = ? THEN NULL ELSE locked_until END,
        last_login_at = ?, updated_at = ?
       WHERE id = ? AND status = 'ACTIVE' AND password_hash = ? AND session_version = ?
       RETURNING id, session_version`,
      [account.failed_attempts, account.failure_window_started_at,
        account.failed_attempts, account.failure_window_started_at,
        account.failed_attempts, account.failure_window_started_at, now, now,
        account.id, account.password_hash, account.session_version],
    ))[0];
    if (!current) return null;
    const user: StudentCredentialUser = {
      id: current.id, kind: "student", studentAccountId: current.id, studentSessionVersion: current.session_version,
    };
    issuedStudentUsers.set(user, { id: current.id, version: current.session_version });
    return user;
  } catch {
    // Unknown phone, bad password, lockout and database failures share the same login result.
    return null;
  }
}

export async function changeStudentPassword(
  accountId: string,
  sessionVersion: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (typeof currentPassword !== "string" || !currentPassword.length || currentPassword.length > 128 ||
    typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128 ||
    newPassword === DEFAULT_STUDENT_PASSWORD || newPassword === currentPassword) {
    throw new StudentCredentialError("Mật khẩu mới phải có 8–128 ký tự, khác mật khẩu hiện tại và mật khẩu mặc định.");
  }
  if (!accountId || !Number.isSafeInteger(sessionVersion) || sessionVersion < 1) throw new StudentCredentialError();
  try {
    const account = await reserveAttempt({ accountId, sessionVersion });
    if (!account) { await verifyDummy(currentPassword); throw new StudentCredentialError(); }
    if (!await verifyPassword(currentPassword, account.password_hash)) throw new StudentCredentialError();
    const passwordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    const updated = await query<{ id: string }>(
      `UPDATE student_accounts SET password_hash = ?, must_change_password = 0,
        session_version = session_version + 1, failed_attempts = 0,
        failure_window_started_at = NULL, locked_until = NULL, password_changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'ACTIVE' AND password_hash = ? AND session_version = ?
       RETURNING id`,
      [passwordHash, now, now, accountId, account.password_hash, sessionVersion],
    );
    if (!updated.length) throw new StudentCredentialError();
  } catch (error) {
    if (error instanceof StudentCredentialError) throw error;
    throw new StudentCredentialError();
  }
}
