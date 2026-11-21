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
  const opensChat = query.tiep === "tro-chuyen";
  const wantsAdmin = query.tiep === "quan-tri";
  const studentDestination = opensChat ? "/hoc-sinh#tro-chuyen" : "/hoc-sinh";
  if (student) redirect(student.must_change_password ? "/hoc-sinh/doi-mat-khau" : studentDestination);
  if (user?.role === "SUPER_ADMIN") redirect(wantsAdmin ? "/admin" : "/teacher");
  if (user?.role === "TEACHER") redirect("/teacher");
  const setup = getSetupState();
  const teacherMode = query.vai === "giaovien" || typeof query.error === "string";
  const studentHref = opensChat ? "/dang-nhap?tiep=tro-chuyen" : "/dang-nhap";
  const teacherHref = wantsAdmin ? "/dang-nhap?vai=giaovien&tiep=quan-tri" : opensChat ? "/dang-nhap?vai=giaovien&tiep=tro-chuyen" : "/dang-nhap?vai=giaovien";

  return <main id="noi-dung" className="unified-login page-width">
    <header className="unified-login-header"><Brand /><Link href="/" className="button button-outline button-small">Trang chủ</Link></header>
    <div className="unified-login-title"><p className="eyebrow">LỚP HỌC HẠNH PHÚC</p><h1>Đăng nhập</h1></div>
    {user ? <section className="student-auth-card unified-login-card"><h2>Tài khoản đang chờ duyệt</h2><p>Quản trị viên cần duyệt quyền và phân công lớp trước khi bạn sử dụng trang giáo viên.</p><SignOutButton /></section> :
      <section className="student-auth-card unified-login-card" aria-labelledby="login-form-title">
        <nav className="unified-login-roles" aria-label="Loại tài khoản">
          <Link href={studentHref} aria-current={!teacherMode ? "page" : undefined}>Học sinh</Link>
          <Link href={teacherHref} aria-current={teacherMode ? "page" : undefined}>Giáo viên</Link>
        </nav>
        {teacherMode ? <div className="unified-google">
          <h2 id="login-form-title">Đăng nhập bằng Google</h2>
          <p className="student-card-description">Dành cho giáo viên và quản trị viên.</p>
          {typeof query.error === "string" && <p className="form-message is-error" role="alert">Chưa thể đăng nhập bằng Google. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>}
          <GoogleSignInButton enabled={setup.ready} callbackUrl={wantsAdmin ? "/dang-nhap?tiep=quan-tri" : "/dang-nhap"} />
          {!setup.ready && <p className="form-message" role="status">Đăng nhập Google đang được thiết lập.</p>}
        </div> : <>
          <h2 id="login-form-title">Vào lớp học</h2>
          <p className="student-card-description">Dùng số điện thoại và mật khẩu đã được cấp.</p>
          {query.changed === "1" && <p className="form-message is-success" role="status">Đã đổi mật khẩu. Em hãy đăng nhập lại bằng mật khẩu mới nhé.</p>}
          {!setup.studentAuthReady && <p className="form-message" role="status">Đăng nhập học sinh đang được thiết lập. Em hãy quay lại sau nhé.</p>}
          <StudentLoginForm enabled={setup.studentAuthReady} destination={studentDestination} />
          <p className="student-support-note">Quên mật khẩu? Em hãy liên hệ giáo viên chủ nhiệm.</p>
        </>}
      </section>}
  </main>;
}
