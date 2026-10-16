"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/rbac";
import { archiveContent, ContentActionError, saveEvent, savePost, saveTask } from "@/lib/class-content";
import { archiveContentSchema, eventSchema, postSchema, taskSchema } from "@/lib/content-schemas";
import { PostImageValidationError } from "@/lib/post-images";

export interface ContentActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

async function runContentAction<T extends z.ZodType>(
  formData: FormData,
  schema: T,
  mutate: (actorId: string, input: z.output<T>, image?: File) => Promise<unknown>,
  message: string,
  acceptsImage = false,
): Promise<ContentActionState> {
  let actor;
  try { actor = await getCurrentUser(); }
  catch { return { success: false, message: "Chưa thể xác minh tài khoản. Thầy cô hãy thử lại sau." }; }
  if (!actor || !["TEACHER", "SUPER_ADMIN"].includes(actor.role)) {
    return { success: false, message: "Tài khoản chưa có quyền biên tập nội dung lớp học. Thầy cô hãy đăng nhập lại hoặc liên hệ quản trị viên." };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return { success: false, message: "Biểu mẫu chứa thông tin bị lặp. Thầy cô hãy tải lại trang và thử lại." };
  }
  const image = acceptsImage ? formData.get("cover_image") : null;
  if (image !== null && (!(image instanceof File) || image.size === 0)) {
    return { success: false, message: "Thầy cô hãy chọn lại ảnh từ thiết bị.", fieldErrors: { cover_url: ["Tệp ảnh không hợp lệ."] } };
  }
  const parsed = schema.safeParse(Object.fromEntries(entries.filter(([key]) => !(acceptsImage && key === "cover_image"))));
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    }
    return { success: false, message: "Thầy cô hãy kiểm tra lại các thông tin đã nhập.", fieldErrors };
  }
  try { await mutate(actor.id, parsed.data, image instanceof File ? image : undefined); }
  catch (error) {
    if (error instanceof PostImageValidationError) return { success: false, message: error.message, fieldErrors: { cover_url: [error.message] } };
    return { success: false, message: error instanceof ContentActionError ? error.message : "Chưa thể lưu nội dung. Thầy cô hãy thử lại sau." };
  }
  revalidatePath("/");
  revalidatePath("/ban-tin/[id]", "page");
  revalidatePath("/hoc-sinh");
  revalidatePath("/teacher");
  return { success: true, message };
}

export async function savePostAction(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  return runContentAction(formData, postSchema, savePost, "Đã lưu bài viết.", true);
}

export async function saveEventAction(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  return runContentAction(formData, eventSchema, saveEvent, "Đã lưu sự kiện.");
}

export async function saveTaskAction(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  return runContentAction(formData, taskSchema, saveTask, "Đã lưu việc cần làm.");
}

export async function archiveContentAction(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const schema = archiveContentSchema.extend({ confirmed: z.literal("on", { error: "Thầy cô cần xác nhận trước khi lưu trữ." }) }).strict();
  return runContentAction(formData, schema, (actorId, { type, id }) => archiveContent(actorId, { type, id }), "Đã lưu trữ nội dung. Nội dung này không còn hiển thị với người đọc.");
}
