"use server";

import { revalidatePath } from "next/cache";
import { toggleTimetableCheck } from "@/lib/class-timetable";
import { toggleTimetableCheckSchema } from "@/lib/timetable-schemas";
import { requireStudentAccount, StudentAuthorizationError } from "@/lib/student-session";

export interface TimetableCheckState { success: boolean; message: string; completed: boolean }
export async function updateTimetableCheck(previous: TimetableCheckState, formData: FormData): Promise<TimetableCheckState> {
  // Previous state keeps the confirmed checkbox stable on errors; it grants no permission.
  const unchanged: TimetableCheckState = { success: false, message: "", completed: previous?.completed === true };
  let account;
  try { account = await requireStudentAccount(); }
  catch (error) {
    return { ...unchanged, message: error instanceof StudentAuthorizationError
      ? "Em hãy đăng nhập lại để tiếp tục nhé." : "Chưa thể xác minh tài khoản. Em hãy thử lại sau nhé." };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return { ...unchanged, message: "Thông tin bị lặp. Em hãy tải lại trang nhé." };
  }
  const parsed = toggleTimetableCheckSchema.safeParse(Object.fromEntries(entries));
  if (!parsed.success) return { ...unchanged, message: "Thông tin đã thay đổi. Em hãy tải lại trang nhé." };
  try { await toggleTimetableCheck(account.id, account.session_version, parsed.data); }
  catch { return { ...unchanged, message: "Chưa lưu được thay đổi. Em hãy tải lại trang rồi thử nhé." }; }
  revalidatePath("/hoc-sinh");
  return { success: true, completed: parsed.data.completed,
    message: parsed.data.completed ? "Đã lưu: em đã hoàn thành mục này." : "Đã lưu: mục này chưa hoàn thành." };
}
