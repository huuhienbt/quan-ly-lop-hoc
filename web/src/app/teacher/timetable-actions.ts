"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/rbac";
import { saveClassTimetable, TimetableActionError } from "@/lib/class-timetable";
import { timetableSchema } from "@/lib/timetable-schemas";

export interface TimetableActionState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export async function saveTimetableAction(_previous: TimetableActionState, formData: FormData): Promise<TimetableActionState> {
  let actor;
  try { actor = await getCurrentUser(); }
  catch { return { success: false, message: "Chưa thể xác minh tài khoản. Thầy cô hãy thử lại sau." }; }
  if (!actor || !["TEACHER", "SUPER_ADMIN"].includes(actor.role)) {
    return { success: false, message: "Thầy cô cần đăng nhập bằng tài khoản được phân công quản lý lớp." };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return { success: false, message: "Biểu mẫu chứa thông tin bị lặp. Thầy cô hãy tải lại trang." };
  }
  const input = Object.fromEntries(entries);
  if (typeof input.lessons !== "string" || input.lessons.length > 200_000) {
    return { success: false, message: "Thông tin các tiết học chưa hợp lệ.", fieldErrors: { lessons: ["Thầy cô hãy kiểm tra lại danh sách tiết học."] } };
  }
  let lessons: unknown;
  try { lessons = JSON.parse(input.lessons); }
  catch { return { success: false, message: "Danh sách tiết học chưa hợp lệ. Thầy cô hãy tải lại trang." }; }
  const parsed = timetableSchema.safeParse({ ...input, lessons });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    return { success: false, message: "Thầy cô hãy kiểm tra lại ngày áp dụng, giờ học và các môn học.", fieldErrors };
  }
  try { await saveClassTimetable(actor.id, parsed.data); }
  catch (error) { return { success: false, message: error instanceof TimetableActionError ? error.message : "Chưa thể lưu thời khóa biểu. Thầy cô hãy thử lại sau." }; }
  revalidatePath("/teacher");
  revalidatePath("/hoc-sinh");
  return { success: true, message: "Đã lưu thời khóa biểu. Bản mới thay thế cả tuần học kể từ ngày áp dụng đã chọn." };
}
