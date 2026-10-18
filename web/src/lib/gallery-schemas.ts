import { z } from "zod";

export const galleryIdSchema = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const galleryImageIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}, "Ngày sự kiện không tồn tại.");
export const galleryAlbumSchema = z.object({
  id: galleryIdSchema.optional(),
  class_id: galleryIdSchema,
  title: z.string().trim().min(1, "Vui lòng nhập tên album.").max(200, "Tên album không quá 200 ký tự."),
  description: z.string().trim().max(2000, "Mô tả không quá 2.000 ký tự.").default(""),
  event_date: z.union([date, z.literal(""), z.null()]).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
}).strict();
export const galleryPhotoUploadSchema = z.object({
  class_id: galleryIdSchema,
  album_id: galleryIdSchema,
  caption: z.string().trim().max(500, "Chú thích không quá 500 ký tự.").default(""),
  client_upload_id: z.string().regex(galleryImageIdPattern, "Mã ảnh không hợp lệ. Hãy chọn lại ảnh."),
}).strict();
export const galleryArchiveAlbumSchema = z.object({ class_id: galleryIdSchema, id: galleryIdSchema }).strict();
export const galleryRemovePhotoSchema = galleryArchiveAlbumSchema.extend({ album_id: galleryIdSchema }).strict();
export type GalleryAlbumInput = z.output<typeof galleryAlbumSchema>;
export type GalleryPhotoUploadInput = z.output<typeof galleryPhotoUploadSchema>;
export interface GalleryIdentity { staffId?: string; studentAccountId?: string; studentSessionVersion?: number }
export interface GalleryAlbum {
  id: string; class_id: string; class_name: string; school_name: string;
  title: string; description: string; event_date: string | null; visibility: "PRIVATE" | "PUBLIC";
  cover_url: string | null; photo_count: number; updated_at: string;
}
export interface GalleryPhoto {
  id: string; album_id: string; class_id: string; url: string; caption: string;
  width: number; height: number; created_at: string;
}
export interface GalleryAlbumPage { album: GalleryAlbum; photos: GalleryPhoto[]; hasMore: boolean; nextOffset: number | null }
