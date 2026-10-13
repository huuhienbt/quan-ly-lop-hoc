"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError, requireSuperAdmin } from "@/lib/rbac";
import {
  addAcademicYear,
  addClass,
  adminSchemas,
  AdminActionError,
  changeUserStatus,
  endHomeroomTeacher,
  reviewTeacherRequest,
  setHomeroomTeacher,
  type ActionState,
} from "@/lib/admin";

async function runAction<T extends z.ZodType>(
  formData: FormData,
  schema: T,
  mutate: (actorId: string, input: z.output<T>) => Promise<void>,
  message: string,
): Promise<ActionState> {
  let actor;
  try {
    actor = await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { success: false, message: error.message };
    }
    // Unexpected configuration/storage failures still fail closed.
    return { success: false, message: "Chưa thể xác minh quyền quản trị. Hãy thử lại sau." };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) {
    return { success: false, message: "Biểu mẫu chứa trường bị lặp. Hãy tải lại trang và thử lại." };
  }
  const parsed = schema.safeParse(Object.fromEntries(entries));
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { success: false, message: "Vui lòng kiểm tra các thông tin đã nhập.", fieldErrors };
  }
  try {
    await mutate(actor.id, parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof AdminActionError
        ? error.message
        : "Chưa thể lưu thay đổi. Tên/đường dẫn có thể đã tồn tại; hãy kiểm tra kết nối D1 và thử lại.",
    };
  }
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true, message };
}

export async function approveTeacherRequest(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, adminSchemas.approval,
    (actorId, input) => reviewTeacherRequest(actorId, input, "APPROVED"), "Đã duyệt tài khoản thành giáo viên.");
}

export async function rejectTeacherRequest(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, adminSchemas.approval,
    (actorId, input) => reviewTeacherRequest(actorId, input, "REJECTED"), "Đã từ chối yêu cầu giáo viên.");
}

export async function createAcademicYear(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, adminSchemas.year, addAcademicYear, "Đã tạo năm học.");
}

export async function createClass(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, adminSchemas.class, addClass, "Đã tạo lớp học riêng tư.");
}

export async function assignTeacher(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, adminSchemas.assignment, setHomeroomTeacher, "Đã phân công giáo viên chủ nhiệm.");
}

export async function endTeacherAssignment(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, adminSchemas.assignment, endHomeroomTeacher, "Đã kết thúc phân công giáo viên.");
}

export async function setUserStatus(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(formData, adminSchemas.userStatus, changeUserStatus,
    formData.get("status") === "SUSPENDED"
      ? "Đã tạm khóa tài khoản và kết thúc các phân công đang có."
      : "Đã kích hoạt lại tài khoản. Cần phân công lại lớp nếu muốn cấp quyền quản trị lớp.");
}
