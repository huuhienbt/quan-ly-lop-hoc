"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/rbac";
import { resetTeacherStudentPassword, TeacherStudentError } from "@/lib/teacher-students";

export type ResetStudentState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; temporaryPassword: string };

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const resetForm = z.object({
  class_id: id,
  enrollment_id: id,
  account_id: id,
  session_version: z.string().regex(/^[1-9][0-9]{0,15}$/).transform(Number)
    .refine(version => Number.isSafeInteger(version) && version < Number.MAX_SAFE_INTEGER),
  confirmed: z.literal("yes"),
}).strict();

export async function resetStudentPasswordAction(_previous: ResetStudentState, formData: FormData): Promise<ResetStudentState> {
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  const input = resetForm.safeParse(Object.fromEntries(entries));
  if (!input.success || entries.length !== new Set(entries.map(([key]) => key)).size) {
    return { kind: "error", message: "Thông tin xác nhận chưa hợp lệ. Thầy cô hãy mở lại danh sách và thử lại." };
  }
  try {
    const actor = await getCurrentUser();
    if (actor?.role !== "TEACHER" && actor?.role !== "SUPER_ADMIN") {
      return { kind: "error", message: "Thầy cô cần đăng nhập bằng tài khoản có quyền quản lý lớp." };
    }
    const temporaryPassword = await resetTeacherStudentPassword(actor.id, input.data);
    revalidatePath("/teacher");
    return { kind: "success", temporaryPassword };
  } catch (error) {
    return { kind: "error", message: error instanceof TeacherStudentError ? error.message
      : "Chưa thể xác nhận kết quả cấp lại mật khẩu. Thầy cô hãy tải lại danh sách trước khi thử lại." };
  }
}
