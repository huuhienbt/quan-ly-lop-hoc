import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetupState } from "@/lib/config";
import { query } from "@/lib/d1";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  image_url: string | null;
  role: "PENDING" | "TEACHER" | "SUPER_ADMIN";
  status: "ACTIVE" | "SUSPENDED";
}

export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Bạn cần đăng nhập để tiếp tục." : "Bạn không có quyền thực hiện thao tác này.");
    this.name = "AuthorizationError";
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Existing sessions remain usable if Google sign-ins are temporarily disabled.
  if (!getSetupState().sessionReady) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = (await query<CurrentUser>(
    `SELECT id, email, name, image_url, role, status FROM users
     WHERE id = ? AND status = 'ACTIVE' AND email_verified_at IS NOT NULL`,
    [session.user.id],
  ))[0];
  return user ?? null;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError(401);
  if (user.role !== "SUPER_ADMIN") throw new AuthorizationError(403);
  return user;
}

export async function requireClassTeacher(classId: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError(401);
  if (user.role !== "TEACHER" && user.role !== "SUPER_ADMIN") throw new AuthorizationError(403);
  const allowed = (await query<{ id: string }>(
    `SELECT c.id FROM classes c JOIN schools s ON s.id = c.school_id
     JOIN users actor ON actor.id = ? AND actor.status = 'ACTIVE' AND actor.email_verified_at IS NOT NULL
     WHERE c.id = ? AND c.archived_at IS NULL AND s.archived_at IS NULL
       AND (actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER' AND EXISTS (
         SELECT 1 FROM class_teachers ct WHERE ct.class_id = c.id AND ct.user_id = actor.id AND ct.ended_at IS NULL
       )))`, [user.id, classId],
  ))[0];
  if (!allowed) throw new AuthorizationError(403);
  return user;
}
