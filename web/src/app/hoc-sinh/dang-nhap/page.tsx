import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentLoginForm } from "@/components/student-auth-forms";
import { ShieldIcon, SunIcon } from "@/components/icons";
import { getSetupState } from "@/lib/config";
import { getCurrentStudentAccount } from "@/lib/student-session";
import { getSiteTheme } from "@/lib/site-theme";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Đăng nhập học sinh" };

export default async function StudentSignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const student = await getCurrentStudentAccount();
  if (student) redirect(student.must_change_password ? "/hoc-sinh/doi-mat-khau" : "/hoc-sinh");
  const setup = getSetupState();
  const query = await searchParams;
  const theme = await getSiteTheme();

  return (
    <main id="noi-dung" className="student-auth-main page-width">
      <section className="student-welcome" aria-labelledby="student-login-title">
        <span className="student-welcome-icon"><SunIcon /></span>
        <p className="eyebrow">GÓC NHỎ DÀNH CHO EM</p>
        <h1 id="student-login-title">Chào em,<br /><span>một ngày thật vui!</span></h1>
        <p>Đăng nhập để xem thông tin của mình và lớp học. Hãy nhờ ba mẹ hoặc thầy cô hỗ trợ nếu em cần nhé.</p>
        <div className="student-login-art" aria-hidden="true"><Image src={(theme === "discovery" || theme === "harmony") ? "/images/discovery-hero-3d.webp" : "/images/happy-school-3d.webp"} alt="" width={1536} height={1024} sizes="(max-width: 760px) 90vw, 440px" /></div>
        <div className="student-trust-note"><ShieldIcon /><span>Chỉ em và người phụ trách được xem thông tin tài khoản của em.</span></div>
      </section>
      <section className="student-auth-card" aria-labelledby="student-form-title">
        <span className="badge badge-green">Dành cho học sinh</span>
        <h2 id="student-form-title">Đăng nhập lớp học</h2>
        <p className="student-card-description">Sử dụng số điện thoại và mật khẩu đã được nhà trường cấp.</p>
        {query.changed === "1" && <p className="form-message is-success" role="status">Đã đổi mật khẩu thành công. Em hãy đăng nhập lại bằng mật khẩu mới nhé.</p>}
        {!setup.studentAuthReady && <p className="student-setup-note" role="status">Đăng nhập học sinh đang được thiết lập. Em hãy quay lại sau nhé.</p>}
        <StudentLoginForm enabled={setup.studentAuthReady} />
        <p className="student-support-note">Quên mật khẩu hoặc chưa có tài khoản?<br />Em hãy liên hệ giáo viên chủ nhiệm để được giúp đỡ.</p>
        <Link className="student-teacher-link" href="/#bat-dau">Đăng nhập dành cho thầy cô</Link>
      </section>
    </main>
  );
}
