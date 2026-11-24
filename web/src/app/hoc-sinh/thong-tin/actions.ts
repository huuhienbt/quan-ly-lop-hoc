"use server";

import { revalidatePath } from "next/cache";
import { requireStudentAccount, StudentAuthorizationError } from "@/lib/student-session";
import { saveStudentProfile, studentProfileInput, StudentProfileError } from "@/lib/student-profile";

export interface ProfileEditState {
  success: boolean;
  message: string;
}

export async function updateStudentProfile(formData: FormData): Promise<ProfileEditState> {
  try {
    const account = await requireStudentAccount({ includeProfileEditor: true });
    const entries = [...formData.entries()].filter(([name]) => !name.startsWith("$ACTION_"));
    if (new Set(entries.map(([name]) => name)).size !== entries.length) {
      return { success: false, message: "Thông tin bị lặp. Em hãy tải lại trang." };
    }
    const parsed = studentProfileInput.safeParse(Object.fromEntries(entries));
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues.some(issue => issue.path[0] === "date_of_birth")
        ? "Ngày sinh chưa hợp lệ." : "Em hãy kiểm tra lại tên hiển thị, ngày sinh, giới tính và ảnh đã chọn." };
    }
    const data = parsed.data;
    if (!account.students.some(student => student.enrollment_id === data.enrollment_id && student.profile_updated_at === data.revision)) {
      return { success: false, message: "Hồ sơ đã thay đổi hoặc em không có quyền sửa. Hãy tải lại trang." };
    }
    await saveStudentProfile({ accountId: account.id, sessionVersion: account.session_version }, data);
    revalidatePath("/hoc-sinh/thong-tin");
    revalidatePath("/");
    return { success: true, message: "Đã lưu thông tin của em." };
  } catch (error) {
    return { success: false, message: error instanceof StudentAuthorizationError || error instanceof StudentProfileError
      ? error.message : "Chưa lưu được thông tin. Em hãy thử lại sau nhé." };
  }
}
