"use server";

import { revalidatePath } from "next/cache";
import { toggleStudentTask } from "@/lib/class-content";
import { toggleTaskSchema } from "@/lib/content-schemas";
import { requireStudentAccount, StudentAuthorizationError } from "@/lib/student-session";

export interface StudentTaskState {
  success: boolean;
  message: string;
  completed: boolean;
}

export async function updateStudentTask(previous: StudentTaskState, formData: FormData): Promise<StudentTaskState> {
  // The previous value only keeps the checkbox stable on errors; it never grants access.
  const unchanged: StudentTaskState = { success: false, message: "", completed: previous?.completed === true };
  let account;
  try {
    account = await requireStudentAccount();
  } catch (error) {
    return { ...unchanged, message: error instanceof StudentAuthorizationError
      ? "Phiên đăng nhập cần được kiểm tra lại. Em hãy đăng nhập rồi thử nhé."
      : "Chưa thể xác minh tài khoản. Em hãy thử lại sau nhé." };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return { ...unchanged, message: "Thông tin chưa hợp lệ. Em hãy tải lại trang và thử nhé." };
  }
  const parsed = toggleTaskSchema.safeParse(Object.fromEntries(entries));
  if (!parsed.success) return { ...unchanged, message: "Thông tin việc cần làm đã thay đổi. Em hãy tải lại trang nhé." };
  try {
    // Neither account identity nor session version comes from the submitted form.
    await toggleStudentTask(account.id, account.session_version, parsed.data);
  } catch {
    return { ...unchanged, message: "Chưa lưu được thay đổi. Dấu đã làm của em được giữ nguyên; em thử lại nhé." };
  }
  revalidatePath("/hoc-sinh");
  return {
    success: true,
    message: parsed.data.completed ? "Đã lưu: em đã hoàn thành việc này." : "Đã lưu: việc này chưa hoàn thành.",
    completed: parsed.data.completed,
  };
}
