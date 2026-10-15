import "server-only";
import { redirect } from "next/navigation";
import { requireStudentAccount, StudentAuthorizationError } from "@/lib/student-session";

export async function requireStudentPageAccount(allowPasswordChange = false) {
  try {
    return await requireStudentAccount({ allowPasswordChange });
  } catch (error) {
    if (error instanceof StudentAuthorizationError) {
      redirect(error.code === "PASSWORD_CHANGE_REQUIRED" ? "/hoc-sinh/doi-mat-khau" : "/hoc-sinh/dang-nhap");
    }
    throw error;
  }
}
