import "server-only";
import { batch, type SqlValue } from "@/lib/d1";
import { vietnamToday } from "@/lib/content-schemas";
import { getCurrentUser } from "@/lib/rbac";
import { requireStudentAccount, StudentAuthorizationError } from "@/lib/student-session";
import {
  chatContextSchema, chatHideSchema, chatReadSchema, chatSendSchema,
  type ChatContext, type ChatHideInput, type ChatMessage, type ChatSendInput,
  type ChatSnapshot, type ChatStudent,
} from "@/lib/chat-schemas";

export class ChatError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 429 | 503, message: string) {
    super(message);
    this.name = "ChatError";
  }
}
export type ChatIdentity = { mode: "teacher"; actorId: string }
  | { mode: "student"; accountId: string; sessionVersion: number };
const unavailable = "Chưa kết nối được phòng trò chuyện. Hãy thử lại sau nhé.";
const denied = "Bạn không có quyền vào phòng trò chuyện này. Hãy tải lại trang hoặc đăng nhập lại.";
const invalid = "Thông tin trò chuyện chưa hợp lệ. Hãy tải lại trang rồi thử nhé.";
export async function resolveChatIdentity(mode: "student" | "teacher"): Promise<ChatIdentity> {
  if (mode === "student") {
    try {
      const account = await requireStudentAccount();
      return { mode, accountId: account.id, sessionVersion: account.session_version };
    } catch (error) {
      if (error instanceof StudentAuthorizationError) throw new ChatError(error.status, error.message);
      throw new ChatError(503, unavailable);
    }
  }
  let actor;
  try { actor = await getCurrentUser(); } catch { throw new ChatError(503, unavailable); }
  if (!actor) throw new ChatError(401, "Thầy cô cần đăng nhập để trò chuyện với lớp.");
  if (!["SUPER_ADMIN", "TEACHER"].includes(actor.role)) throw new ChatError(403, denied);
  return { mode, actorId: actor.id };
}
const joins = `JOIN schools school ON school.id = c.school_id
  JOIN academic_years year ON year.id = c.academic_year_id AND year.school_id = c.school_id`;
function access(identity: ChatIdentity, context: ChatContext): { sql: string; params: SqlValue[] } {
  if (!chatContextSchema.safeParse(context).success || identity.mode !== context.mode) throw new ChatError(400, invalid);
  const day = vietnamToday();
  const sql = `c.id = ? AND c.archived_at IS NULL AND school.archived_at IS NULL
    AND ? BETWEEN year.starts_on AND year.ends_on`;
  const params: SqlValue[] = [context.class_id, day];
  const thread = context.thread_enrollment_id;
  const targetGuard = thread ? ` AND EXISTS (SELECT 1 FROM student_enrollments target
    JOIN students pupil ON pupil.id = target.student_id AND pupil.school_id = target.school_id AND pupil.archived_at IS NULL
    WHERE target.id = ? AND target.class_id = c.id AND target.school_id = c.school_id
      AND target.academic_year_id = c.academic_year_id AND target.status = 'ACTIVE'
      AND target.enrolled_on <= ?)` : "";
  if (identity.mode === "teacher") return {
    sql: `${sql} AND EXISTS (SELECT 1 FROM users actor WHERE actor.id = ? AND actor.status = 'ACTIVE'
      AND actor.email_verified_at IS NOT NULL AND (actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER'
        AND EXISTS (SELECT 1 FROM class_teachers assignment WHERE assignment.class_id = c.id
          AND assignment.user_id = actor.id AND assignment.ended_at IS NULL))))${targetGuard}`,
    params: [...params, identity.actorId, ...(thread ? [thread, day] : [])],
  };
  if (!Number.isSafeInteger(identity.sessionVersion) || identity.sessionVersion < 1) throw new ChatError(403, denied);
  return {
    sql: `${sql} AND EXISTS (SELECT 1 FROM student_accounts login
      JOIN student_account_students link ON link.account_id = login.id
      JOIN students pupil ON pupil.id = link.student_id AND pupil.archived_at IS NULL
      JOIN student_enrollments enrollment ON enrollment.student_id = pupil.id AND enrollment.school_id = pupil.school_id
      WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE' AND login.must_change_password = 0
        AND enrollment.id = ? AND enrollment.class_id = c.id AND enrollment.school_id = c.school_id
        AND enrollment.academic_year_id = c.academic_year_id AND enrollment.status = 'ACTIVE'
        AND enrollment.enrolled_on <= ?)${targetGuard}`,
    params: [...params, identity.accountId, identity.sessionVersion, context.enrollment_id!, day, ...(thread ? [thread, day] : [])],
  };
}
function rosterSql(guard: ReturnType<typeof access>) {
  return {
    sql: `SELECT enrollment.id AS enrollment_id, COALESCE(NULLIF(pupil.display_name, ''), pupil.full_name) AS student_name,
      (SELECT message.created_at FROM class_chat_messages message
        WHERE message.class_id = c.id AND message.thread_enrollment_id = enrollment.id
        ORDER BY message.created_at DESC, message.id DESC LIMIT 1) AS last_message_at
      FROM classes c ${joins}
      JOIN student_enrollments enrollment ON enrollment.class_id = c.id AND enrollment.school_id = c.school_id
        AND enrollment.academic_year_id = c.academic_year_id AND enrollment.status = 'ACTIVE'
      JOIN students pupil ON pupil.id = enrollment.student_id AND pupil.school_id = enrollment.school_id AND pupil.archived_at IS NULL
      WHERE ${guard.sql} AND enrollment.enrolled_on <= ?
      ORDER BY last_message_at DESC, student_name COLLATE NOCASE, enrollment.id`,
    params: [...guard.params, vietnamToday()],
  };
}
export async function getTeacherChatStudents(actorId: string, classId: string): Promise<ChatStudent[]> {
  const guard = access({ mode: "teacher", actorId }, { mode: "teacher", class_id: classId });
  const result = await batch([
    { sql: `SELECT c.id FROM classes c ${joins} WHERE ${guard.sql}`, params: guard.params }, rosterSql(guard),
  ]);
  if (!result[0].results.length) throw new ChatError(403, denied);
  return result[1].results as unknown as ChatStudent[];
}
export async function getChatSnapshot(identity: ChatIdentity, context: ChatContext, beforeId?: string, throughId?: string): Promise<ChatSnapshot> {
  if (!chatReadSchema.safeParse({ ...context, before_id: beforeId, through_id: throughId }).success) throw new ChatError(400, invalid);
  const guard = access(identity, context), thread = context.thread_enrollment_id ?? null;
  const cursorId = beforeId ?? throughId;
  const own = identity.mode === "teacher" ? "message.sender_user_id = ?" : "message.sender_account_id = ? AND message.sender_enrollment_id = ?";
  const ownParams = identity.mode === "teacher" ? [identity.actorId] : [identity.accountId, context.enrollment_id!];
  const result = await batch([
    { sql: `SELECT c.id FROM classes c ${joins} WHERE ${guard.sql}`, params: guard.params },
    { sql: `SELECT message.id, message.sender_kind,
        CASE WHEN message.sender_kind = 'TEACHER' THEN staff.name
          ELSE COALESCE(NULLIF(pupil.display_name, ''), pupil.full_name) END AS sender_name,
        CASE WHEN message.hidden_at IS NULL THEN message.body ELSE '' END AS body,
        message.created_at, (${own}) AS is_own, (message.hidden_at IS NOT NULL) AS is_hidden
      FROM class_chat_messages message JOIN classes c ON c.id = message.class_id ${joins}
      LEFT JOIN users staff ON staff.id = message.sender_user_id
      LEFT JOIN student_enrollments sent_enrollment ON sent_enrollment.id = message.sender_enrollment_id AND sent_enrollment.class_id = message.class_id
      LEFT JOIN students pupil ON pupil.id = sent_enrollment.student_id
      WHERE ${guard.sql} AND message.thread_enrollment_id IS ?
        AND (? IS NULL OR EXISTS (SELECT 1 FROM class_chat_messages cursor
          WHERE cursor.id = ? AND cursor.class_id = c.id AND cursor.thread_enrollment_id IS ?
            AND (message.created_at < cursor.created_at OR (message.created_at = cursor.created_at AND message.id ${throughId ? "<=" : "<"} cursor.id))))
      ORDER BY message.created_at DESC, message.id DESC LIMIT 51`,
    params: [...ownParams, ...guard.params, thread, cursorId ?? null, cursorId ?? null, thread] },
    { sql: `SELECT message.id FROM class_chat_messages message JOIN classes c ON c.id = message.class_id ${joins}
      WHERE ${guard.sql} AND message.thread_enrollment_id IS ? AND message.id = ?`,
    params: [...guard.params, thread, cursorId ?? null] },
    ...(identity.mode === "teacher" ? [rosterSql(guard)] : []),
  ]);
  if (!result[0].results.length) throw new ChatError(403, denied);
  if (cursorId && !result[2].results.length) throw new ChatError(400, "Mốc tin nhắn đã thay đổi. Hãy tải lại phòng trò chuyện.");
  const rows = result[1].results as unknown as (Omit<ChatMessage, "is_own" | "is_hidden"> & { is_own: number; is_hidden: number })[];
  return {
    messages: rows.slice(0, 50).reverse().map((row) => ({ ...row, is_own: !!row.is_own, is_hidden: !!row.is_hidden })),
    has_more: rows.length > 50,
    ...(identity.mode === "teacher" ? { students: result[3].results as unknown as ChatStudent[] } : {}),
  };
}
export async function sendChatMessage(identity: ChatIdentity, value: ChatSendInput): Promise<{ id: string }> {
  const parsed = chatSendSchema.safeParse(value);
  if (!parsed.success) throw new ChatError(400, invalid);
  const input = parsed.data;
  const context: ChatContext = { mode: input.mode, class_id: input.class_id,
    enrollment_id: input.enrollment_id, thread_enrollment_id: input.thread_enrollment_id };
  const guard = access(identity, context);
  const actorKey = identity.mode === "teacher" ? `teacher:${identity.actorId}` : `student:${identity.accountId}`;
  const id = crypto.randomUUID(), now = new Date(), createdAt = now.toISOString();
  const recent = new Date(now.getTime() - 3000).toISOString(), minute = new Date(now.getTime() - 60_000).toISOString();
  const senderUser = identity.mode === "teacher" ? identity.actorId : null;
  const senderAccount = identity.mode === "student" ? identity.accountId : null;
  const senderEnrollment = identity.mode === "student" ? input.enrollment_id! : null;
  const thread = input.thread_enrollment_id ?? null;
  // Insertion, throttling, duplicate lookup and live authorization share one
  // atomic D1 batch. Simultaneous requests cannot bypass the database limit.
  const result = await batch([
    { sql: `INSERT INTO class_chat_messages
      (id, class_id, thread_enrollment_id, sender_kind, sender_user_id, sender_account_id, sender_enrollment_id, client_message_id, body, created_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, ?, ?, ? FROM classes c ${joins}
      WHERE ${guard.sql}
        AND NOT EXISTS (SELECT 1 FROM class_chat_messages duplicate WHERE duplicate.actor_key = ? AND duplicate.client_message_id = ?)
        AND NOT EXISTS (SELECT 1 FROM class_chat_messages recent WHERE recent.actor_key = ? AND recent.created_at > ?)
        AND (SELECT count(*) FROM class_chat_messages recent WHERE recent.actor_key = ? AND recent.created_at > ?) < 20`,
    params: [id, thread, identity.mode === "teacher" ? "TEACHER" : "STUDENT", senderUser, senderAccount, senderEnrollment,
      input.client_message_id, input.body, createdAt, ...guard.params,
      actorKey, input.client_message_id, actorKey, recent, actorKey, minute] },
    { sql: `SELECT message.id, message.class_id, message.thread_enrollment_id, message.sender_enrollment_id, message.body
      FROM class_chat_messages message CROSS JOIN classes c ${joins}
      WHERE ${guard.sql} AND message.actor_key = ? AND message.client_message_id = ?`,
    params: [...guard.params, actorKey, input.client_message_id] },
    { sql: `SELECT c.id FROM classes c ${joins} WHERE ${guard.sql}`, params: guard.params },
  ]);
  if (!result[2].results.length) throw new ChatError(403, denied);
  const saved = result[1].results[0];
  if (!saved) throw new ChatError(429, "Bạn gửi hơi nhanh. Hãy chờ vài giây rồi thử lại nhé.");
  if (saved.class_id !== input.class_id || saved.thread_enrollment_id !== thread
    || saved.sender_enrollment_id !== senderEnrollment || saved.body !== input.body) {
    throw new ChatError(400, "Lượt gửi này đã được dùng cho tin nhắn khác. Hãy tải lại phòng trò chuyện.");
  }
  return { id: String(saved.id) };
}
export async function hideChatMessage(identity: ChatIdentity, value: ChatHideInput): Promise<void> {
  const parsed = chatHideSchema.safeParse(value);
  if (!parsed.success || identity.mode !== "teacher") throw new ChatError(403, denied);
  const input = parsed.data;
  const guard = access(identity, { mode: "teacher", class_id: input.class_id, thread_enrollment_id: input.thread_enrollment_id });
  const thread = input.thread_enrollment_id ?? null;
  const result = await batch([
    { sql: `UPDATE class_chat_messages SET hidden_at = ?, hidden_by = ?
      WHERE id = ? AND class_id = ? AND thread_enrollment_id IS ? AND hidden_at IS NULL
        AND EXISTS (SELECT 1 FROM classes c ${joins} WHERE c.id = class_chat_messages.class_id AND ${guard.sql})`,
    params: [new Date().toISOString(), identity.actorId, input.message_id, input.class_id, thread, ...guard.params] },
    { sql: `INSERT INTO audit_logs (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
      SELECT ?, ?, c.school_id, c.id, 'CHAT_MESSAGE_HIDDEN', 'class_chat_message', message.id, ?
      FROM class_chat_messages message JOIN classes c ON c.id = message.class_id ${joins}
      WHERE changes() > 0 AND message.id = ? AND message.thread_enrollment_id IS ? AND message.hidden_by = ? AND ${guard.sql}`,
    params: [crypto.randomUUID(), identity.actorId, JSON.stringify({ room: thread ? "PRIVATE" : "CLASS" }),
      input.message_id, thread, identity.actorId, ...guard.params] },
    { sql: `SELECT message.id FROM class_chat_messages message JOIN classes c ON c.id = message.class_id ${joins}
      WHERE ${guard.sql} AND message.id = ? AND message.thread_enrollment_id IS ? AND message.hidden_at IS NOT NULL`,
    params: [...guard.params, input.message_id, thread] },
    { sql: `SELECT c.id FROM classes c ${joins} WHERE ${guard.sql}`, params: guard.params },
  ]);
  if (!result[3].results.length) throw new ChatError(403, denied);
  if (!result[2].results.length) throw new ChatError(400, "Không tìm thấy tin nhắn trong phòng này. Hãy tải lại phòng trò chuyện.");
}
