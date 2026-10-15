import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth-buttons";
import { StudentPasswordForm } from "@/components/student-auth-forms";
import { ShieldIcon } from "@/components/icons";
import { requireStudentPageAccount } from "../student-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Đổi mật khẩu học sinh" };

export default async function StudentPasswordPage() {
  const account = await requireStudentPageAccount(true);
  return (
    <main id="noi-dung" className="student-password-main page-width">
      <section className="student-password-card" aria-labelledby="student-password-title">
        <div className="student-page-toolbar"><span className="student-lock-icon"><ShieldIcon /></span><SignOutButton /></div>
        <p className="eyebrow">GIỮ TÀI KHOẢN CỦA EM AN TOÀN</p>
        <h1 id="student-password-title">{account.must_change_password ? "Đổi mật khẩu lần đầu" : "Đổi mật khẩu"}</h1>
        <p className="student-card-description">{account.must_change_password ? "Trước khi vào lớp học, em hãy chọn một mật khẩu riêng. Ba mẹ có thể giúp em thực hiện bước này." : "Chọn một mật khẩu riêng để bảo vệ thông tin của em."}</p>
        <StudentPasswordForm forced={account.must_change_password} />
        <p className="student-support-note">Sau khi đổi mật khẩu, em cần đăng nhập lại trên các thiết bị đang sử dụng.</p>
      </section>
    </main>
  );
}
