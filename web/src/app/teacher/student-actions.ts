"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/rbac";
import { resetTeacherStudentPassword, resetTeacherStudentPasswords, setTeacherStudentPassword, TeacherStudentError, type BulkResetReceipt } from "@/lib/teacher-students";
import { STUDENT_BULK_RESET_LIMIT, STUDENT_PASSWORD_LENGTH_MESSAGE, STUDENT_PASSWORD_MIN_LENGTH, STUDENT_PASSWORD_MAX_LENGTH } from "@/lib/student-reset-options";

export type ResetStudentState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; temporaryPassword: string };

export type BulkResetStudentState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | ({ kind: "success" } & BulkResetReceipt);

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const resetForm = z.object({
  class_id: id,
  enrollment_id: id,
  account_id: id,
  session_version: z.string().regex(/^[1-9][0-9]{0,15}$/).transform(Number)
    .refine(version => Number.isSafeInteger(version) && version < Number.MAX_SAFE_INTEGER),
  confirmed: z.literal("yes"),
}).strict();

const manualForm = resetForm.extend({
  temporary_password: z.string().min(STUDENT_PASSWORD_MIN_LENGTH).max(STUDENT_PASSWORD_MAX_LENGTH),
});

const bulkForm = z.object({
  class_id: id,
  targets: z.string().min(2).max(30_000),
  confirmed: z.literal("yes"),
}).strict();

const bulkTargets = z.array(z.object({
  enrollment_id: id,
  account_id: id,
  session_version: z.number().int().min(1).lt(Number.MAX_SAFE_INTEGER),
}).strict()).min(1).max(STUDENT_BULK_RESET_LIMIT)
  .refine(targets => new Set(targets.map(target => target.account_id)).size === targets.length);

function uniqueFormFields(formData: FormData) {
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  return entries.length === new Set(entries.map(([key]) => key)).size ? Object.fromEntries(entries) : null;
}

export async function resetStudentPasswordAction(_previous: ResetStudentState, formData: FormData): Promise<ResetStudentState> {
  const input = resetForm.safeParse(uniqueFormFields(formData));
  if (!input.success) {
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

export async function resetStudentPasswordsAction(_previous: BulkResetStudentState, formData: FormData): Promise<BulkResetStudentState> {
  const invalid: BulkResetStudentState = { kind: "error", message: "Danh sách xác nhận chưa hợp lệ. Thầy cô hãy chọn lại các tài khoản." };
  const input = bulkForm.safeParse(uniqueFormFields(formData));
  if (!input.success) return invalid;
  let targets: unknown;
  try { targets = JSON.parse(input.data.targets); } catch { return invalid; }
  const selected = bulkTargets.safeParse(targets);
  if (!selected.success) return invalid;

  try {
    const actor = await getCurrentUser();
    if (actor?.role !== "TEACHER" && actor?.role !== "SUPER_ADMIN") {
      return { kind: "error", message: "Thầy cô cần đăng nhập bằng tài khoản có quyền quản lý lớp." };
    }
    const receipt = await resetTeacherStudentPasswords(actor.id, input.data.class_id, selected.data);
    revalidatePath("/teacher");
    return { kind: "success", ...receipt };
  } catch (error) {
    return { kind: "error", message: error instanceof TeacherStudentError ? error.message
      : "Chưa thể xác nhận kết quả cấp lại. Hãy tải lại danh sách trước khi thử lại." };
  }
}

export async function setStudentPasswordAction(_previous: BulkResetStudentState, formData: FormData): Promise<BulkResetStudentState> {
  const input = manualForm.safeParse(uniqueFormFields(formData));
  if (!input.success) {
    const invalidPassword = input.error.issues.some(issue => issue.path[0] === "temporary_password");
    return { kind: "error", message: invalidPassword ? STUDENT_PASSWORD_LENGTH_MESSAGE
      : "Thông tin xác nhận chưa hợp lệ. Thầy cô hãy mở lại danh sách và thử lại." };
  }
  try {
    const actor = await getCurrentUser();
    if (actor?.role !== "TEACHER" && actor?.role !== "SUPER_ADMIN") {
      return { kind: "error", message: "Thầy cô cần đăng nhập bằng tài khoản có quyền quản lý lớp." };
    }
    const { class_id, enrollment_id, account_id, session_version, temporary_password } = input.data;
    const receipt = await setTeacherStudentPassword(actor.id, { class_id, enrollment_id, account_id, session_version }, temporary_password);
    revalidatePath("/teacher");
    return { kind: "success", ...receipt };
  } catch (error) {
    return { kind: "error", message: error instanceof TeacherStudentError ? error.message
      : "Chưa thể xác nhận kết quả đặt mật khẩu. Thầy cô hãy tải lại danh sách trước khi thử lại." };
  }
}
