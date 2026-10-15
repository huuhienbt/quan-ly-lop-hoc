import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth-buttons";
import { ShieldIcon, SunIcon } from "@/components/icons";
import { requireStudentPageAccount } from "./student-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Góc học sinh" };

const genderLabels: Record<string, string> = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác", UNSPECIFIED: "Chưa cập nhật" };

function dateOfBirth(value: string | null) {
  if (!value) return "Chưa cập nhật";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default async function StudentHomePage() {
  const account = await requireStudentPageAccount();
  const firstStudent = account.students[0];
  const greeting = account.students.length === 1 && firstStudent ? `Chào ${firstStudent.display_name || firstStudent.full_name}!` : "Chào mừng đến với góc học sinh!";

  return (
    <main id="noi-dung" className="student-dashboard-main page-width">
      <div className="student-page-toolbar"><p className="eyebrow">LỚP HỌC HẠNH PHÚC · GÓC HỌC SINH</p><SignOutButton /></div>
      <section className="student-dashboard-welcome" aria-labelledby="student-dashboard-title"><div><span className="badge badge-green">Một ngày đến lớp, một ngày vui</span><h1 id="student-dashboard-title">{greeting}</h1><p>Đây là thông tin học sinh được liên kết với tài khoản của em.</p></div><SunIcon /></section>
      <section className="student-profiles-section" aria-labelledby="student-profiles-title">
        <div className="student-profile-heading"><h2 id="student-profiles-title">Thông tin học sinh</h2><Link className="button button-outline button-small" href="/hoc-sinh/doi-mat-khau"><ShieldIcon /> Đổi mật khẩu</Link></div>
        {account.students.length ? <div className="student-profiles-grid">{account.students.map((student) => <article className="student-profile-card" key={`${student.id}-${student.class_id}`}>
          <div className="student-profile-top"><span className="student-profile-avatar" aria-hidden="true">{student.full_name.slice(0, 1).toLocaleUpperCase("vi")}</span><div><h3>{student.full_name}</h3><p>{student.school_name}</p></div></div>
          <dl className="student-profile-details"><div><dt>Lớp học</dt><dd>{student.class_name}</dd></div><div><dt>Năm học</dt><dd>{student.academic_year_name}</dd></div><div><dt>Ngày sinh</dt><dd>{dateOfBirth(student.date_of_birth)}</dd></div><div><dt>Giới tính</dt><dd>{genderLabels[student.gender] ?? "Chưa cập nhật"}</dd></div></dl>
        </article>)}</div> : <div className="student-empty-profile"><h3>Chưa có thông tin lớp học</h3><p>Em hãy liên hệ giáo viên chủ nhiệm để kiểm tra thông tin tài khoản nhé.</p></div>}
        <p className="student-profile-privacy"><ShieldIcon /> Nếu thông tin cần điều chỉnh, em hãy nhờ ba mẹ liên hệ giáo viên chủ nhiệm.</p>
      </section>
    </main>
  );
}
