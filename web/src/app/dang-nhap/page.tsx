import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { StudentLoginForm } from "@/components/student-auth-forms";
import { getSetupState } from "@/lib/config";
import { getCurrentUser } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";
import "./login.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Đăng nhập" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [student, user, query] = await Promise.all([getCurrentStudentAccount(), getCurrentUser(), searchParams]);
  if (student) redirect(student.must_change_password ? "/hoc-sinh/doi-mat-khau" : "/hoc-sinh");
  if (user?.role === "SUPER_ADMIN") redirect("/admin");
  if (user?.role === "TEACHER") redirect("/teacher");
  const setup = getSetupState();

  return <main id="noi-dung" className="unified-login page-width">
    <header className="unified-login-header"><Brand /><Link href="/" className="button button-outline button-small">Trang chủ</Link></header>
    <div className="unified-login-title"><p className="eyebrow">LỚP HỌC HẠNH PHÚC</p><h1>Đăng nhập</h1><p>Chọn cách đăng nhập phù hợp với tài khoản của bạn.</p></div>
    {typeof query.error === "string" && <p className="form-message is-error" role="alert">Chưa thể đăng nhập bằng Google. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>}
    {user ? <section className="student-auth-card unified-pending"><h2>Tài khoản đang chờ duyệt</h2><p>Quản trị viên cần duyệt quyền và phân công lớp trước khi bạn sử dụng trang giáo viên.</p><SignOutButton /></section> : <div className="unified-login-grid">
      <section className="student-auth-card" aria-labelledby="pupil-login-title"><span className="badge badge-green">Học sinh</span><h2 id="pupil-login-title">Vào lớp học</h2><p className="student-card-description">Dùng số điện thoại và mật khẩu đã được cấp.</p>{!setup.studentAuthReady && <p className="form-message" role="status">Đăng nhập học sinh đang được thiết lập. Em hãy quay lại sau nhé.</p>}<StudentLoginForm enabled={setup.studentAuthReady} /><p className="student-support-note">Quên mật khẩu? Em hãy liên hệ giáo viên chủ nhiệm.</p></section>
      <section className="student-auth-card unified-google" aria-labelledby="staff-login-title"><span className="badge badge-amber">Giáo viên và quản trị viên</span><h2 id="staff-login-title">Quản lý lớp học</h2><p>Sử dụng tài khoản Google đã đăng ký với nhà trường.</p><GoogleSignInButton enabled={setup.ready} callbackUrl="/dang-nhap" />{!setup.ready && <p className="form-message" role="status">Đăng nhập Google đang được thiết lập.</p>}<p className="student-support-note">Tài khoản mới cần được quản trị viên duyệt và phân công lớp.</p></section>
    </div>}
  </main>;
}
