import "server-only";
import { execute, query } from "@/lib/d1";
import { MAX_LESSON_IMAGE, MAX_LESSON_PDF, lessonAssetId } from "@/lib/lessons";
import { normalizePostImage } from "@/lib/post-images";
import { lessonClassActive, lessonStaffAccess, lessonStudentAccess } from "@/lib/lesson-access";

export class LessonFileError extends Error {}

const chunkSize = 480 * 1024; // 640 KiB after Base64, within the existing 1 MiB gateway request limit.
const validId = /^[A-Za-z0-9_-]{1,100}$/;

export async function stageLessonAsset(actorId: string, classId: string, kind: "image" | "pdf", file: File) {
  const limit = kind === "pdf" ? MAX_LESSON_PDF : MAX_LESSON_IMAGE;
  if (!file.size || file.size > limit) throw new LessonFileError("Tệp phải có dung lượng từ 1 byte đến 3 MB.");
  const mime = kind === "pdf" ? "application/pdf" : "image/webp";
  const allowed = await query(`SELECT c.id FROM classes c JOIN schools school ON school.id = c.school_id
    WHERE c.id = ? AND ${lessonClassActive} AND ${lessonStaffAccess}`, [classId, actorId]);
  if (!allowed.length) throw new LessonFileError("Thầy cô không có quyền đăng tài liệu cho lớp này.");
  let bytes: Buffer;
  if (kind === "image") {
    bytes = Buffer.from((await normalizePostImage(file, MAX_LESSON_IMAGE)).dataBase64, "base64");
  } else {
    bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-" || !bytes.subarray(-2048).includes(Buffer.from("%%EOF"))) {
      throw new LessonFileError("Tệp PDF không hợp lệ. Thầy cô hãy chọn lại tệp.");
    }
  }
  const id = crypto.randomUUID();
  const now = new Date();
  const previousDay = new Date(now.getTime() - 86400000).toISOString();
  await execute(`DELETE FROM lesson_assets WHERE id IN (
    SELECT id FROM lesson_assets WHERE class_id = ? AND uploaded_by = ?
      AND post_id IS NULL AND created_at < ? LIMIT 30)`, [classId, actorId, previousDay]);
  const inserted = await execute(`INSERT INTO lesson_assets (id, class_id, uploaded_by, mime, byte_size, created_at)
    SELECT ?, c.id, ?, ?, ?, ? FROM classes c JOIN schools school ON school.id = c.school_id
    WHERE c.id = ? AND ${lessonClassActive} AND ${lessonStaffAccess}`, [id, actorId, mime, bytes.length, now.toISOString(), classId, actorId]);
  if (!inserted.meta.changes) throw new LessonFileError("Thầy cô không còn quyền đăng tài liệu cho lớp này.");
  try {
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      await execute("INSERT INTO lesson_asset_parts (asset_id, part, data_base64) VALUES (?, ?, ?)",
        [id, offset / chunkSize, bytes.subarray(offset, offset + chunkSize).toString("base64")]);
    }
    await execute("UPDATE lesson_assets SET ready = 1 WHERE id = ?", [id]);
  } catch (error) {
    await execute("DELETE FROM lesson_assets WHERE id = ? AND post_id IS NULL", [id]).catch(() => {});
    throw error;
  }
  return { id };
}

export async function readLessonAsset(id: string, viewer: { staffId?: string; studentId?: string; version?: number }) {
  if (!lessonAssetId.safeParse(id).success) return null;
  const staff = viewer.staffId && validId.test(viewer.staffId) ? viewer.staffId : "";
  const student = viewer.studentId && validId.test(viewer.studentId) ? viewer.studentId : "";
  const version = Number.isSafeInteger(viewer.version) && (viewer.version ?? 0) > 0 ? viewer.version! : 0;
  const rows = await query<{ mime: string; byte_size: number; data_base64: string }>(`SELECT a.mime, a.byte_size, part.data_base64
    FROM lesson_assets a JOIN lesson_asset_parts part ON part.asset_id = a.id
    JOIN classes c ON c.id = a.class_id JOIN schools school ON school.id = c.school_id
    WHERE a.id = ? AND a.ready = 1 AND ${lessonClassActive} AND (
      (${lessonStaffAccess} AND (a.post_id IS NOT NULL OR a.uploaded_by = ?))
      OR EXISTS (SELECT 1 FROM posts p, json_each(COALESCE(p.lesson_content, p.bulletin_content)) block
        WHERE p.id = a.post_id AND p.class_id = c.id AND p.status = 'PUBLISHED'
          AND json_extract(block.value, '$.assetId') = a.id
          AND ((p.visibility = 'PUBLIC' AND p.bulletin_content IS NOT NULL) OR ${lessonStudentAccess}))
    ) ORDER BY part.part`, [id, staff, staff, student, version]);
  if (!rows.length) return null;
  const bytes = Buffer.concat(rows.map((row) => Buffer.from(row.data_base64, "base64")));
  if (bytes.length !== rows[0].byte_size) throw new Error("Incomplete lesson file");
  return { bytes, mime: rows[0].mime };
}
