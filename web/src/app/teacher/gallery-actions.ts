"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/rbac";
import { archiveGalleryAlbum, GalleryActionError, removeGalleryPhoto, saveGalleryAlbum, uploadGalleryPhoto } from "@/lib/class-gallery";
import { galleryAlbumSchema, galleryArchiveAlbumSchema, galleryPhotoUploadSchema, galleryRemovePhotoSchema } from "@/lib/gallery-schemas";
import { PostImageValidationError } from "@/lib/post-images";

export interface GalleryActionState { success: boolean; message: string; album_id?: string; fieldErrors?: Record<string, string[]> }

async function run<T extends z.ZodType>(formData: FormData, schema: T,
  mutate: (actorId: string, input: z.output<T>, image?: File) => Promise<string | void>, message: string, acceptsImage = false): Promise<GalleryActionState> {
  let actor;
  try { actor = await getCurrentUser(); }
  catch { return { success: false, message: "Chưa thể xác minh tài khoản. Hãy thử lại sau." }; }
  if (!actor || !["TEACHER", "SUPER_ADMIN"].includes(actor.role)) {
    return { success: false, message: "Thầy cô cần đăng nhập bằng tài khoản được phân công quản lý lớp." };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return { success: false, message: "Biểu mẫu chứa thông tin bị lặp. Hãy tải lại trang." };
  const image = acceptsImage ? formData.get("image") : null;
  if (acceptsImage && (!(image instanceof File) || image.size <= 0)) return { success: false, message: "Vui lòng chọn ảnh từ thiết bị.", fieldErrors: { image: ["Chưa chọn ảnh hợp lệ."] } };
  const parsed = schema.safeParse(Object.fromEntries(entries.filter(([key]) => !(acceptsImage && key === "image"))));
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    return { success: false, message: "Hãy kiểm tra lại thông tin album và ảnh.", fieldErrors };
  }
  let result: string | void;
  try { result = await mutate(actor.id, parsed.data, image instanceof File ? image : undefined); }
  catch (error) {
    if (error instanceof PostImageValidationError) return { success: false, message: error.message, fieldErrors: { image: [error.message] } };
    return { success: false, message: error instanceof GalleryActionError ? error.message : "Chưa thể lưu thư viện ảnh. Hãy thử lại sau." };
  }
  revalidatePath("/"); revalidatePath("/thu-vien-anh"); revalidatePath("/thu-vien-anh/[id]", "page");
  revalidatePath("/teacher"); revalidatePath("/hoc-sinh");
  const input = parsed.data as { album_id?: string; id?: string };
  return { success: true, message, album_id: acceptsImage ? input.album_id : typeof result === "string" ? result : input.album_id ?? input.id };
}

export async function saveAlbumAction(_previous: GalleryActionState, formData: FormData): Promise<GalleryActionState> {
  return run(formData, galleryAlbumSchema, saveGalleryAlbum, "Đã lưu album ảnh.");
}
export async function createAlbumAction(_previous: GalleryActionState, formData: FormData): Promise<GalleryActionState> {
  return run(formData, galleryAlbumSchema.omit({ id: true }).strict(), saveGalleryAlbum, "Đã tạo album ảnh. Thầy cô có thể thêm ảnh từ thiết bị.");
}
export async function uploadGalleryPhotoAction(_previous: GalleryActionState, formData: FormData): Promise<GalleryActionState> {
  return run(formData, galleryPhotoUploadSchema, (actorId, input, image) => uploadGalleryPhoto(actorId, input, image!), "Đã thêm ảnh vào album.", true);
}
export async function archiveGalleryAlbumAction(_previous: GalleryActionState, formData: FormData): Promise<GalleryActionState> {
  const schema = galleryArchiveAlbumSchema.extend({ confirmed: z.literal("on", { error: "Vui lòng xác nhận lưu trữ album." }) }).strict();
  return run(formData, schema, (actorId, { class_id, id }) => archiveGalleryAlbum(actorId, { class_id, id }), "Đã lưu trữ album. Album và ảnh không còn hiển thị.");
}
export async function removeGalleryPhotoAction(_previous: GalleryActionState, formData: FormData): Promise<GalleryActionState> {
  const schema = galleryRemovePhotoSchema.extend({ confirmed: z.literal("on", { error: "Vui lòng xác nhận ẩn ảnh." }) }).strict();
  return run(formData, schema, (actorId, { class_id, album_id, id }) => removeGalleryPhoto(actorId, { class_id, album_id, id }), "Đã ẩn ảnh khỏi thư viện.");
}
