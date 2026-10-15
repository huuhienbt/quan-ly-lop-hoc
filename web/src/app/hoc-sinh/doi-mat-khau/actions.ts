"use server";

import { z } from "zod";
import { changeStudentPassword, StudentCredentialError } from "@/lib/student-credentials";
import { requireStudentAccount, StudentAuthorizationError } from "@/lib/student-session";

export interface StudentPasswordState {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

const passwordInput = z.object({
  current_password: z.string().min(1, "Em hãy nhập mật khẩu hiện tại.").max(128, "Mật khẩu không hợp lệ."),
  new_password: z.string().min(8, "Mật khẩu mới cần ít nhất 8 ký tự.").max(128, "Mật khẩu mới không được quá 128 ký tự."),
  confirm_password: z.string().min(1, "Em hãy nhập lại mật khẩu mới.").max(128, "Mật khẩu không hợp lệ."),
}).strict().refine((input) => input.new_password === input.confirm_password, {
  path: ["confirm_password"], message: "Hai lần nhập mật khẩu mới chưa khớp nhau.",
});

export async function updateStudentPassword(_previous: StudentPasswordState, formData: FormData): Promise<StudentPasswordState> {
  let account;
  try {
    account = await requireStudentAccount({ allowPasswordChange: true });
  } catch (error) {
    if (error instanceof StudentAuthorizationError) return { success: false, message: "Phiên đăng nhập đã hết hạn. Em hãy đăng nhập lại." };
    return { success: false, message: "Chưa thể xác minh tài khoản. Em hãy thử lại sau." };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    return { success: false, message: "Biểu mẫu chưa hợp lệ. Em hãy tải lại trang và thử lại." };
  }
  const parsed = passwordInput.safeParse(Object.fromEntries(entries));
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
    }
    return { success: false, message: "Em hãy kiểm tra lại các thông tin bên dưới nhé.", fieldErrors };
  }
  try {
    await changeStudentPassword(account.id, account.session_version, parsed.data.current_password, parsed.data.new_password);
    return { success: true, message: "Đã đổi mật khẩu. Đang chuyển đến trang đăng nhập…" };
  } catch (error) {
    return { success: false, message: error instanceof StudentCredentialError ? error.message : "Chưa thể đổi mật khẩu. Em hãy thử lại sau." };
  }
}
