import "server-only";

import { createHash } from "node:crypto";
import { batch, query, type D1Statement, type SqlValue } from "@/lib/d1";
import { MAX_POST_IMAGE_BYTES, normalizePostImage } from "@/lib/post-images";
import {
  galleryAlbumSchema, galleryArchiveAlbumSchema, galleryIdSchema, galleryImageIdPattern,
  galleryPhotoUploadSchema, galleryRemovePhotoSchema,
  type GalleryAlbum, type GalleryAlbumInput, type GalleryAlbumPage, type GalleryIdentity,
  type GalleryPhoto, type GalleryPhotoUploadInput,
} from "@/lib/gallery-schemas";

export type { GalleryAlbum, GalleryAlbumPage, GalleryIdentity, GalleryPhoto } from "@/lib/gallery-schemas";

export class GalleryActionError extends Error {
  constructor(message = "Không thể lưu thư viện ảnh. Hãy kiểm tra quyền quản lý lớp và thử lại.") {
    super(message); this.name = "GalleryActionError";
  }
}

const active = "c.archived_at IS NULL AND school.archived_at IS NULL";
const staffAccess = `EXISTS (SELECT 1 FROM users actor WHERE actor.id = ? AND actor.status = 'ACTIVE'
  AND actor.email_verified_at IS NOT NULL AND (actor.role = 'SUPER_ADMIN' OR (actor.role = 'TEACHER'
  AND EXISTS (SELECT 1 FROM class_teachers assignment WHERE assignment.class_id = c.id
    AND assignment.user_id = actor.id AND assignment.ended_at IS NULL))))`;
const studentAccess = `EXISTS (SELECT 1 FROM student_accounts login
  JOIN student_account_students link ON link.account_id = login.id
  JOIN students pupil ON pupil.id = link.student_id AND pupil.archived_at IS NULL
  JOIN student_enrollments enrollment ON enrollment.student_id = pupil.id
    AND enrollment.school_id = pupil.school_id AND enrollment.status = 'ACTIVE'
  WHERE login.id = ? AND login.session_version = ? AND login.status = 'ACTIVE'
    AND login.must_change_password = 0 AND enrollment.class_id = c.id
    AND enrollment.school_id = c.school_id AND enrollment.academic_year_id = c.academic_year_id)`;
const readable = `(album.visibility = 'PUBLIC' OR ${staffAccess} OR ${studentAccess})`;
const joins = "JOIN classes c ON c.id = album.class_id JOIN schools school ON school.id = c.school_id";
const albumFields = `album.id, album.class_id, c.name AS class_name, school.name AS school_name,
  album.title, COALESCE(album.description, '') AS description, album.event_date, album.visibility, album.updated_at,
  (SELECT asset.url FROM photos photo JOIN media_assets asset ON asset.id = photo.asset_id AND asset.class_id = photo.class_id
    JOIN gallery_images image ON image.asset_id = asset.id AND image.class_id = asset.class_id
    WHERE photo.album_id = album.id AND photo.class_id = album.class_id AND photo.archived_at IS NULL
    ORDER BY photo.sort_order, photo.created_at, photo.id LIMIT 1) AS cover_url,
  (SELECT count(*) FROM photos photo JOIN gallery_images image ON image.asset_id = photo.asset_id AND image.class_id = photo.class_id
    WHERE photo.album_id = album.id AND photo.class_id = album.class_id AND photo.archived_at IS NULL) AS photo_count`;
const photoFields = `photo.id, photo.album_id, photo.class_id, asset.url, COALESCE(photo.caption, '') AS caption,
  image.width, image.height, photo.created_at`;
const photoJoins = `JOIN albums album ON album.id = photo.album_id AND album.class_id = photo.class_id ${joins}
  JOIN media_assets asset ON asset.id = photo.asset_id AND asset.class_id = photo.class_id
  JOIN gallery_images image ON image.asset_id = asset.id AND image.class_id = asset.class_id`;
const order = "COALESCE(album.event_date, substr(album.created_at, 1, 10)) DESC, album.created_at DESC, album.id";

function identityParams(identity: GalleryIdentity): SqlValue[] {
  const id = (value: unknown) => galleryIdSchema.safeParse(value).success ? value as string : "";
  return [id(identity.staffId), id(identity.studentAccountId),
    Number.isSafeInteger(identity.studentSessionVersion) && identity.studentSessionVersion! > 0 ? identity.studentSessionVersion! : 0];
}
function validId(id: unknown): id is string { return galleryIdSchema.safeParse(id).success; }
function limitValue(value: number, maximum: number) { return Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : maximum; }
export function galleryImageUrl(assetId: string) {
  if (!galleryImageIdPattern.test(assetId)) throw new GalleryActionError("Mã ảnh không hợp lệ.");
  return `/api/gallery-images/${assetId}`;
}

export async function getPublicGalleryAlbums(limit = 8): Promise<GalleryAlbum[]> {
  return query<GalleryAlbum>(`SELECT ${albumFields} FROM albums album ${joins}
    WHERE album.archived_at IS NULL AND album.visibility = 'PUBLIC' AND ${active}
    ORDER BY ${order} LIMIT ?`, [limitValue(limit, 100)]);
}

export async function getGalleryAlbums(identity: GalleryIdentity = {}, classId?: string): Promise<GalleryAlbum[]> {
  if (classId !== undefined && !validId(classId)) return [];
  return query<GalleryAlbum>(`SELECT ${albumFields} FROM albums album ${joins}
    WHERE album.archived_at IS NULL AND ${active} AND ${readable} ${classId ? "AND c.id = ?" : ""}
    ORDER BY ${order} LIMIT 100`, [...identityParams(identity), ...(classId ? [classId] : [])]);
}

export async function getGalleryAlbum(id: string, identity: GalleryIdentity = {}, offset = 0): Promise<GalleryAlbumPage | null> {
  if (!validId(id) || !Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) return null;
  const params = identityParams(identity);
  const album = (await query<GalleryAlbum>(`SELECT ${albumFields} FROM albums album ${joins}
    WHERE album.id = ? AND album.archived_at IS NULL AND ${active} AND ${readable}`, [id, ...params]))[0];
  if (!album) return null;
  // Recheck live visibility and membership on the photo query, including during an album policy change.
  const rows = await query<GalleryPhoto>(`SELECT ${photoFields} FROM photos photo ${photoJoins}
    WHERE album.id = ? AND album.archived_at IS NULL AND photo.archived_at IS NULL AND ${active} AND ${readable}
    ORDER BY photo.sort_order, photo.created_at, photo.id LIMIT 61 OFFSET ?`, [id, ...params, offset]);
  return { album, photos: rows.slice(0, 60), hasMore: rows.length > 60, nextOffset: rows.length > 60 ? offset + 60 : null };
}

export async function getTeacherGallery(actorId: string, classId: string): Promise<{ albums: GalleryAlbum[]; photos: GalleryPhoto[] }> {
  if (!validId(actorId) || !validId(classId)) return { albums: [], photos: [] };
  const [albums, photos] = await Promise.all([
    query<GalleryAlbum>(`SELECT ${albumFields} FROM albums album ${joins}
      WHERE album.class_id = ? AND album.archived_at IS NULL AND ${active} AND ${staffAccess}
      ORDER BY ${order} LIMIT 100`, [classId, actorId]),
    query<GalleryPhoto>(`SELECT ${photoFields} FROM photos photo ${photoJoins}
      WHERE album.class_id = ? AND album.archived_at IS NULL AND photo.archived_at IS NULL AND ${active} AND ${staffAccess}
      ORDER BY photo.created_at DESC, photo.id LIMIT 60`, [classId, actorId]),
  ]);
  return { albums, photos };
}

function audit(actorId: string, classId: string, action: string, type: string, entityId: string, details: object = {}): D1Statement {
  return { sql: `INSERT INTO audit_logs (id, actor_user_id, school_id, class_id, action, entity_type, entity_id, details_json)
    SELECT ?, ?, c.school_id, c.id, ?, ?, ?, ? FROM classes c JOIN schools school ON school.id = c.school_id
    WHERE changes() > 0 AND c.id = ? AND ${active} AND ${staffAccess}`,
  params: [crypto.randomUUID(), actorId, action, type, entityId, JSON.stringify(details), classId, actorId] };
}

export async function saveGalleryAlbum(actorId: string, input: GalleryAlbumInput): Promise<string> {
  const result = galleryAlbumSchema.safeParse(input);
  if (!validId(actorId) || !result.success) throw new GalleryActionError("Thông tin album không hợp lệ.");
  input = result.data;
  const id = input.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const write: D1Statement = input.id ? {
    sql: `UPDATE albums SET title = ?, description = ?, event_date = ?, visibility = ?, updated_at = ?
      WHERE id = ? AND class_id = ? AND archived_at IS NULL AND EXISTS (
        SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id
        WHERE c.id = albums.class_id AND ${active} AND ${staffAccess})`,
    params: [input.title, input.description, input.event_date || null, input.visibility, now, id, input.class_id, actorId],
  } : {
    sql: `INSERT INTO albums (id, class_id, title, description, event_date, visibility, created_by, created_at, updated_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, ?, ? FROM classes c JOIN schools school ON school.id = c.school_id
      WHERE c.id = ? AND ${active} AND ${staffAccess}`,
    params: [id, input.title, input.description, input.event_date || null, input.visibility, actorId, now, now, input.class_id, actorId],
  };
  const rows = await batch([write, audit(actorId, input.class_id, input.id ? "GALLERY_ALBUM_UPDATED" : "GALLERY_ALBUM_CREATED", "album", id, { visibility: input.visibility })]);
  if (rows[0]?.meta.changes !== 1 || rows[1]?.meta.changes !== 1) throw new GalleryActionError();
  return id;
}

export async function archiveGalleryAlbum(actorId: string, input: { class_id: string; id: string }): Promise<void> {
  const result = galleryArchiveAlbumSchema.safeParse(input);
  if (!validId(actorId) || !result.success) throw new GalleryActionError("Album không hợp lệ.");
  input = result.data;
  const now = new Date().toISOString();
  const rows = await batch([{
    sql: `UPDATE albums SET archived_at = ?, updated_at = ? WHERE id = ? AND class_id = ? AND archived_at IS NULL
      AND EXISTS (SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id
        WHERE c.id = albums.class_id AND ${active} AND ${staffAccess})`,
    params: [now, now, input.id, input.class_id, actorId],
  }, audit(actorId, input.class_id, "GALLERY_ALBUM_ARCHIVED", "album", input.id)]);
  if (rows[0]?.meta.changes !== 1 || rows[1]?.meta.changes !== 1) throw new GalleryActionError();
}

export async function uploadGalleryPhoto(actorId: string, input: GalleryPhotoUploadInput, file: File): Promise<string> {
  const parsed = galleryPhotoUploadSchema.safeParse(input);
  if (!validId(actorId) || !parsed.success) throw new GalleryActionError("Thông tin ảnh không hợp lệ.");
  input = parsed.data;
  if (!(await query<{ id: string }>(`SELECT album.id FROM albums album ${joins}
    WHERE album.id = ? AND album.class_id = ? AND album.archived_at IS NULL AND ${active} AND ${staffAccess}`,
  [input.album_id, input.class_id, actorId])).length) throw new GalleryActionError("Bạn không có quyền thêm ảnh vào album này.");
  const image = await normalizePostImage(file);
  const digest = createHash("sha256").update(Buffer.from(image.dataBase64, "base64")).digest("hex");
  const id = input.client_upload_id;
  const url = galleryImageUrl(id);
  const now = new Date().toISOString();
  const rows = await batch([
    { sql: `INSERT INTO media_assets (id, class_id, uploaded_by, url, mime_type, alt_text, width, height, created_at)
      SELECT ?, c.id, ?, ?, ?, ?, ?, ?, ? FROM albums album ${joins}
      WHERE album.id = ? AND album.class_id = ? AND album.archived_at IS NULL AND ${active} AND ${staffAccess}
      ON CONFLICT(id) DO NOTHING`,
    params: [id, actorId, url, image.contentType, input.caption, image.width, image.height, now, input.album_id, input.class_id, actorId] },
    { sql: `INSERT INTO gallery_images (asset_id, class_id, content_type, byte_size, width, height, sha256, data_base64, created_at)
      SELECT asset.id, asset.class_id, ?, ?, ?, ?, ?, ?, ? FROM media_assets asset
      JOIN albums album ON album.id = ? AND album.class_id = asset.class_id ${joins}
      WHERE changes() > 0 AND asset.id = ? AND asset.uploaded_by = ? AND album.archived_at IS NULL AND ${active} AND ${staffAccess}`,
    params: [image.contentType, image.byteSize, image.width, image.height, digest, image.dataBase64, now, input.album_id, id, actorId, actorId] },
    { sql: `INSERT INTO photos (id, class_id, album_id, asset_id, caption, sort_order, added_by, created_at)
      SELECT ?, c.id, album.id, image.asset_id, ?, COALESCE((SELECT max(old.sort_order) + 1 FROM photos old WHERE old.album_id = album.id), 0), ?, ?
      FROM albums album ${joins} JOIN gallery_images image ON image.class_id = c.id AND image.asset_id = ?
      WHERE changes() > 0 AND album.id = ? AND album.class_id = ? AND album.archived_at IS NULL AND ${active} AND ${staffAccess}`,
    params: [id, input.caption, actorId, now, id, input.album_id, input.class_id, actorId] },
    { sql: `UPDATE albums SET updated_at = ? WHERE changes() > 0 AND id = ? AND class_id = ? AND archived_at IS NULL
      AND EXISTS (SELECT 1 FROM classes c JOIN schools school ON school.id = c.school_id
        WHERE c.id = albums.class_id AND ${active} AND ${staffAccess})`,
    params: [now, input.album_id, input.class_id, actorId] },
    audit(actorId, input.class_id, "GALLERY_PHOTO_UPLOADED", "photo", id, { album_id: input.album_id }),
  ]);
  if (rows.every((row) => row.meta.changes === 1)) return id;
  // A stable client key permits a safe retry after a lost response. A changed file,
  // caption, album or actor cannot reuse the key; archived photos stay archived.
  const retry = (await query<{ id: string }>(`SELECT photo.id FROM photos photo ${photoJoins}
    WHERE photo.id = ? AND photo.album_id = ? AND photo.class_id = ? AND photo.added_by = ?
      AND asset.uploaded_by = ? AND image.sha256 = ? AND COALESCE(photo.caption, '') = ?
      AND photo.archived_at IS NULL AND album.archived_at IS NULL AND ${active} AND ${staffAccess}`,
  [id, input.album_id, input.class_id, actorId, actorId, digest, input.caption, actorId]))[0];
  if (!retry) throw new GalleryActionError("Ảnh chưa được lưu hoặc mã ảnh đã được sử dụng. Hãy chọn lại ảnh và thử lại.");
  return retry.id;
}

export async function removeGalleryPhoto(actorId: string, input: { class_id: string; album_id: string; id: string }): Promise<void> {
  const parsed = galleryRemovePhotoSchema.safeParse(input);
  if (!validId(actorId) || !parsed.success) throw new GalleryActionError("Ảnh không hợp lệ.");
  input = parsed.data;
  const now = new Date().toISOString();
  const rows = await batch([{
    sql: `UPDATE photos SET archived_at = ? WHERE id = ? AND album_id = ? AND class_id = ? AND archived_at IS NULL
      AND EXISTS (SELECT 1 FROM albums album ${joins} WHERE album.id = photos.album_id
        AND album.class_id = photos.class_id AND album.archived_at IS NULL AND ${active} AND ${staffAccess})`,
    params: [now, input.id, input.album_id, input.class_id, actorId],
  }, audit(actorId, input.class_id, "GALLERY_PHOTO_HIDDEN", "photo", input.id, { album_id: input.album_id })]);
  if (rows[0]?.meta.changes !== 1 || rows[1]?.meta.changes !== 1) throw new GalleryActionError();
}

interface ImageRow { data_base64: string; content_type: string; byte_size: number; sha256: string }
export async function getGalleryImage(assetId: string, identity: GalleryIdentity = {}): Promise<{ bytes: Buffer; contentType: "image/webp"; byteSize: number } | null> {
  if (!galleryImageIdPattern.test(assetId)) return null;
  const row = (await query<ImageRow>(`SELECT image.data_base64, image.content_type, image.byte_size, image.sha256
    FROM gallery_images image JOIN media_assets asset ON asset.id = image.asset_id AND asset.class_id = image.class_id
    JOIN photos photo ON photo.asset_id = asset.id AND photo.class_id = asset.class_id
    JOIN albums album ON album.id = photo.album_id AND album.class_id = photo.class_id ${joins}
    WHERE image.asset_id = ? AND album.archived_at IS NULL AND photo.archived_at IS NULL AND ${active} AND ${readable} LIMIT 1`,
  [assetId, ...identityParams(identity)]))[0];
  if (!row || row.content_type !== "image/webp" || !Number.isSafeInteger(row.byte_size) || row.byte_size <= 0 || row.byte_size > MAX_POST_IMAGE_BYTES
    || typeof row.data_base64 !== "string" || row.data_base64.length !== 4 * Math.ceil(row.byte_size / 3)) return null;
  const bytes = Buffer.from(row.data_base64, "base64");
  if (bytes.length !== row.byte_size || bytes.toString("base64") !== row.data_base64 || bytes.toString("ascii", 0, 4) !== "RIFF"
    || bytes.toString("ascii", 8, 12) !== "WEBP" || createHash("sha256").update(bytes).digest("hex") !== row.sha256) return null;
  return { bytes, contentType: "image/webp", byteSize: bytes.length };
}
