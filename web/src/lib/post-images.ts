import "server-only";

import sharp from "sharp";
import { query } from "@/lib/d1";

export const MAX_POST_IMAGE_INPUT_BYTES = 700 * 1024;
export const MAX_POST_IMAGE_BYTES = 256 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;
const imageIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const identityPattern = /^[a-zA-Z0-9_-]{1,100}$/;

export interface NormalizedPostImage {
  dataBase64: string;
  contentType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
}

export class PostImageValidationError extends Error {
  constructor(message = "Không thể đọc ảnh. Thầy cô hãy chọn ảnh JPG, PNG hoặc WebP khác.") {
    super(message);
    this.name = "PostImageValidationError";
  }
}

function detectedFormat(bytes: Buffer): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export function postImageUrl(id: string): string {
  if (!imageIdPattern.test(id)) throw new PostImageValidationError("Ảnh bài viết không hợp lệ.");
  return `/api/post-images/${id}`;
}

export async function normalizePostImage(file: File): Promise<NormalizedPostImage> {
  if (!file || typeof file.arrayBuffer !== "function" || !Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new PostImageValidationError("Thầy cô hãy chọn một ảnh từ thiết bị.");
  }
  if (file.size > MAX_POST_IMAGE_INPUT_BYTES) {
    throw new PostImageValidationError("Ảnh quá lớn. Thầy cô hãy chọn ảnh nhỏ hơn 700 KB.");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length !== file.size || bytes.length > MAX_POST_IMAGE_INPUT_BYTES) throw new PostImageValidationError();
    const format = detectedFormat(bytes);
    if (!format || (file.type && file.type !== `image/${format}`)) throw new PostImageValidationError();
    const options = { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" as const, sequentialRead: true };
    const metadata = await sharp(bytes, options).metadata();
    if (metadata.format !== format || !metadata.width || !metadata.height ||
      metadata.width * metadata.height > MAX_IMAGE_PIXELS || (metadata.pages ?? 1) !== 1) {
      throw new PostImageValidationError("Ảnh quá lớn hoặc là ảnh động. Thầy cô hãy chọn ảnh tĩnh JPG, PNG hoặc WebP.");
    }
    for (const [size, quality] of [[1600, 82], [1600, 68], [1280, 68], [1024, 60]]) {
      // Auto-orient and re-encode pixels. sharp strips EXIF/GPS and other metadata by default.
      const { data, info } = await sharp(bytes, options).rotate()
        .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
      if (data.length > 0 && data.length <= MAX_POST_IMAGE_BYTES) {
        return { dataBase64: data.toString("base64"), contentType: "image/webp", byteSize: data.length,
          width: info.width, height: info.height };
      }
    }
    throw new PostImageValidationError("Ảnh có quá nhiều chi tiết. Thầy cô hãy chọn ảnh nhỏ hơn hoặc cắt gọn ảnh.");
  } catch (error) {
    if (error instanceof PostImageValidationError) throw error;
    throw new PostImageValidationError();
  }
}

export interface PostImageIdentity {
  staffId?: string;
  studentAccountId?: string;
  studentSessionVersion?: number;
}

interface StoredPostImage {
  data_base64: string;
  content_type: string;
  byte_size: number;
}

export async function getPostImage(id: string, identity: PostImageIdentity = {}): Promise<{
  bytes: Buffer; contentType: "image/webp"; byteSize: number;
} | null> {
  if (typeof id !== "string" || !imageIdPattern.test(id)) return null;
  const staffId = typeof identity.staffId === "string" && identityPattern.test(identity.staffId) ? identity.staffId : "";
  const studentAccountId = typeof identity.studentAccountId === "string" && identityPattern.test(identity.studentAccountId)
    ? identity.studentAccountId : "";
  const studentVersion = Number.isSafeInteger(identity.studentSessionVersion) && identity.studentSessionVersion! > 0
    ? identity.studentSessionVersion! : 0;
  const row = (await query<StoredPostImage>(`SELECT image.data_base64, image.content_type, image.byte_size
    FROM post_images image
    JOIN classes c ON c.id = image.class_id AND c.archived_at IS NULL
    JOIN schools school ON school.id = c.school_id AND school.archived_at IS NULL
    WHERE image.id = ? AND (
      EXISTS (SELECT 1 FROM users actor WHERE actor.id = ? AND actor.status = 'ACTIVE'
        AND actor.email_verified_at IS NOT NULL
        AND (actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER' AND EXISTS (
          SELECT 1 FROM class_teachers assignment WHERE assignment.class_id = c.id
            AND assignment.user_id = actor.id AND assignment.ended_at IS NULL))))
      OR EXISTS (SELECT 1 FROM posts post WHERE post.class_id = c.id AND post.cover_url = ?
        AND post.status = 'PUBLISHED' AND (post.visibility = 'PUBLIC' OR EXISTS (
          SELECT 1 FROM student_accounts login
          JOIN student_account_students link ON link.account_id = login.id
          JOIN students pupil ON pupil.id = link.student_id AND pupil.archived_at IS NULL
          JOIN student_enrollments enrollment ON enrollment.student_id = pupil.id
            AND enrollment.school_id = pupil.school_id AND enrollment.status = 'ACTIVE'
          WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
            AND login.must_change_password = 0 AND enrollment.class_id = c.id
            AND enrollment.school_id = c.school_id AND enrollment.academic_year_id = c.academic_year_id
        )))
    )`, [id, staffId, postImageUrl(id), studentAccountId, studentVersion]))[0];
  if (!row || row.content_type !== "image/webp" || !Number.isSafeInteger(row.byte_size) ||
    row.byte_size <= 0 || row.byte_size > MAX_POST_IMAGE_BYTES || typeof row.data_base64 !== "string" ||
    row.data_base64.length !== 4 * Math.ceil(row.byte_size / 3)) return null;
  const bytes = Buffer.from(row.data_base64, "base64");
  if (bytes.length !== row.byte_size || bytes.toString("base64") !== row.data_base64 || detectedFormat(bytes) !== "webp") return null;
  return { bytes, contentType: "image/webp", byteSize: bytes.length };
}
