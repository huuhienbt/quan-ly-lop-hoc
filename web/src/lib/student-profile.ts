import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { batch, query } from "@/lib/d1";
import { vietnamToday } from "@/lib/content-schemas";
import { lessonStaffAccess } from "@/lib/lesson-access";
import type { StudentRequestIdentity } from "@/lib/student-session";
import { AVATAR_FILE_TYPES, AVATAR_KEY_PREFIX, AVATAR_SIZE, MAX_AVATAR_BYTES, MAX_AVATAR_UPLOAD_BYTES,
  studentGenders } from "@/lib/student-profile-options";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const inputPixels = 16_000_000;

function birthDateValid(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > vietnamToday()) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const studentProfileInput = z.object({
  enrollment_id: id,
  revision: z.string().min(1).max(80),
  date_of_birth: z.string().refine(birthDateValid, "Ngày sinh chưa hợp lệ.").transform(value => value || null),
  gender: z.enum(studentGenders),
  avatar_intent: z.enum(["keep", "replace", "remove"]),
  avatar: z.instanceof(File).optional(),
}).strict().refine(input => (input.avatar_intent === "replace") === !!input.avatar,
  { message: "Thông tin ảnh đại diện chưa hợp lệ.", path: ["avatar"] });

export type StudentProfileInput = z.output<typeof studentProfileInput>;

export class StudentProfileError extends Error {}

function rasterFormat(bytes: Buffer): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function normalizeStudentAvatar(file: File): Promise<Buffer> {
  if (!(file instanceof File) || !file.size || file.size > MAX_AVATAR_UPLOAD_BYTES) {
    throw new StudentProfileError("Ảnh gửi lên quá lớn hoặc bị thiếu. Em hãy chọn lại ảnh từ thiết bị.");
  }
  if (file.type && !AVATAR_FILE_TYPES.some(type => type === file.type)) {
    throw new StudentProfileError("Em hãy chọn ảnh JPG, PNG hoặc WebP.");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const format = rasterFormat(bytes);
    if (!format || bytes.length !== file.size || (file.type && file.type !== `image/${format}`)) throw new Error();
    const options = { limitInputPixels: inputPixels, failOn: "error" as const, sequentialRead: true };
    const meta = await sharp(bytes, options).metadata();
    if (meta.format !== format || !meta.width || !meta.height ||
      meta.width * meta.height > inputPixels || (meta.pages ?? 1) !== 1) throw new Error();
    // Fresh raster output strips EXIF/GPS and other source metadata.
    for (const quality of [82, 65, 45]) {
      const result = await sharp(bytes, options).rotate().resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "centre" })
        .webp({ quality, effort: 3 }).toBuffer();
      if (result.length > 0 && result.length <= MAX_AVATAR_BYTES) return result;
    }
  } catch {
    throw new StudentProfileError("Không đọc được ảnh này. Em hãy chọn ảnh tĩnh JPG, PNG hoặc WebP khác.");
  }
  throw new StudentProfileError("Chưa lưu được ảnh vì dung lượng còn lớn. Em hãy chọn ảnh đơn giản hơn.");
}

const ownEnrollment = `SELECT e.student_id FROM student_enrollments e
  JOIN students pupil ON pupil.id = e.student_id AND pupil.school_id = e.school_id AND pupil.archived_at IS NULL
  JOIN classes c ON c.id = e.class_id AND c.school_id = e.school_id
    AND c.academic_year_id = e.academic_year_id AND c.archived_at IS NULL
  JOIN schools school ON school.id = c.school_id AND school.archived_at IS NULL
  JOIN student_account_students link ON link.student_id = pupil.id
  JOIN student_accounts login ON login.id = link.account_id
  WHERE e.id = ? AND login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
    AND login.must_change_password = 0 AND e.status = 'ACTIVE'
    AND (login.temporary_password_expires_at IS NULL OR login.temporary_password_expires_at > ?)`;

function validIdentity(identity: StudentRequestIdentity) {
  return id.safeParse(identity.accountId).success && Number.isSafeInteger(identity.sessionVersion) && identity.sessionVersion > 0;
}

export async function saveStudentProfile(identity: StudentRequestIdentity, input: StudentProfileInput): Promise<void> {
  if (!validIdentity(identity)) throw new StudentProfileError("Em hãy đăng nhập lại.");
  const avatar = input.avatar_intent === "replace" && input.avatar
    ? AVATAR_KEY_PREFIX + (await normalizeStudentAvatar(input.avatar)).toString("base64") : null;
  const now = new Date();
  const previousTime = Date.parse(input.revision);
  const updated = new Date(Math.max(now.getTime(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();
  const [result] = await batch([
    {
      sql: `UPDATE students SET date_of_birth = ?, gender = ?,
        avatar_key = CASE WHEN ? = 'keep' THEN avatar_key ELSE ? END, updated_at = ?
        WHERE id IN (${ownEnrollment}) AND updated_at = ?`,
      params: [input.date_of_birth, input.gender, input.avatar_intent, avatar, updated,
        input.enrollment_id, identity.accountId, identity.sessionVersion, now.toISOString(), input.revision],
    }, {
      sql: `INSERT INTO audit_logs (id, school_id, class_id, action, entity_type, entity_id, details_json)
        SELECT ?, e.school_id, e.class_id, 'STUDENT_PROFILE_UPDATED', 'student', e.student_id, ?
        FROM student_enrollments e WHERE e.id = ? AND changes() = 1`,
      params: [randomUUID(), JSON.stringify({ student_account_id: identity.accountId, avatar_changed: input.avatar_intent !== "keep" }), input.enrollment_id],
    },
  ]);
  if (result.meta.changes !== 1) throw new StudentProfileError("Hồ sơ đã thay đổi hoặc em không còn quyền sửa. Hãy tải lại trang rồi thử lại.");
}

export type StudentAvatarViewer = StudentRequestIdentity | { actorId: string };

export async function readStudentAvatar(identity: StudentAvatarViewer, enrollmentId: string): Promise<Buffer | null> {
  if (!id.safeParse(enrollmentId).success) return null;
  const staff = "actorId" in identity;
  if (staff ? !id.safeParse(identity.actorId).success : !validIdentity(identity)) return null;
  const day = vietnamToday();
  // The owner can see their portrait in their account. For chat, only active
  // classmates and staff authorized for that class can read the same image.
  const classWindow = "e.enrolled_on <= ? AND ? BETWEEN year.starts_on AND year.ends_on";
  const guard = staff ? `(${classWindow} AND ${lessonStaffAccess})` : `EXISTS (
    SELECT 1 FROM student_accounts login
    JOIN student_account_students link ON link.account_id = login.id
    JOIN students viewer ON viewer.id = link.student_id AND viewer.archived_at IS NULL
    JOIN student_enrollments membership ON membership.student_id = viewer.id AND membership.school_id = viewer.school_id
    WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
      AND login.must_change_password = 0
      AND (login.temporary_password_expires_at IS NULL OR login.temporary_password_expires_at > ?)
      AND membership.class_id = c.id AND membership.school_id = c.school_id
      AND membership.academic_year_id = c.academic_year_id AND membership.status = 'ACTIVE'
      AND (membership.id = e.id OR (membership.enrolled_on <= ? AND ${classWindow})))`;
  const [stored] = await query<{ avatar_key: string | null }>(
    `SELECT pupil.avatar_key FROM student_enrollments e
      JOIN students pupil ON pupil.id = e.student_id AND pupil.school_id = e.school_id AND pupil.archived_at IS NULL
      JOIN classes c ON c.id = e.class_id AND c.school_id = e.school_id
        AND c.academic_year_id = e.academic_year_id AND c.archived_at IS NULL
      JOIN schools school ON school.id = c.school_id AND school.archived_at IS NULL
      JOIN academic_years year ON year.id = c.academic_year_id AND year.school_id = c.school_id
      WHERE e.id = ? AND e.status = 'ACTIVE' AND ${guard}`,
    [enrollmentId, ...(staff ? [day, day, identity.actorId]
      : [identity.accountId, identity.sessionVersion, new Date().toISOString(), day, day, day])],
  );
  if (!stored?.avatar_key?.startsWith(AVATAR_KEY_PREFIX)) return null;
  const encoded = stored.avatar_key.slice(AVATAR_KEY_PREFIX.length);
  if (encoded.length > 4 * Math.ceil(MAX_AVATAR_BYTES / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, "base64");
  return bytes.length <= MAX_AVATAR_BYTES && bytes.toString("base64") === encoded && rasterFormat(bytes) === "webp"
    ? bytes : null;
}
