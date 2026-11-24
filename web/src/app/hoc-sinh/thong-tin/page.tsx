import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth-buttons";
import { ShieldIcon } from "@/components/icons";
import { StudentProfileAvatar, StudentProfileEditor } from "@/components/student-profile-editor";
import { vietnamToday } from "@/lib/content-schemas";
import { genderLabels, studentAvatarUrl } from "@/lib/student-profile-options";
import { requireStudentPageAccount } from "../student-access";
import "./student-account.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tài khoản học sinh" };

function dateOfBirth(value: string | null) {
  if (!value) return "Chưa cập nhật";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default async function StudentAccountPage() {
  const account = await requireStudentPageAccount(false, true);
  const today = vietnamToday();
  return <main id="noi-dung" className="student-dashboard-main student-account-page page-width">
    <div className="student-profile-heading"><h1>Tài khoản học sinh</h1><SignOutButton /></div>
    <section aria-labelledby="student-profiles-title">
      <h2 id="student-profiles-title" className="student-account-section-title">Thông tin học sinh</h2>
      {account.students.length ? <div className="student-profiles-grid">
        {account.students.map((student) => {
          const revision = student.profile_updated_at;
          const avatar = student.has_avatar === 1 && revision ? studentAvatarUrl(student.enrollment_id, revision) : null;
          return <article className="student-profile-card" key={student.enrollment_id}>
            <div className="student-profile-top">
              <StudentProfileAvatar name={student.full_name} src={avatar} />
              <div><h3>{student.full_name}</h3><p>{student.school_name}</p>
                {student.display_name && student.display_name !== student.full_name && <p>Tên hiển thị: {student.display_name}</p>}
              </div>
            </div>
            <dl className="student-profile-details">
              <div><dt>Lớp học</dt><dd>{student.class_name}</dd></div>
              <div><dt>Năm học</dt><dd>{student.academic_year_name}</dd></div>
              <div><dt>Ngày sinh</dt><dd>{dateOfBirth(student.date_of_birth)}</dd></div>
              <div><dt>Giới tính</dt><dd>{genderLabels[student.gender] ?? "Chưa cập nhật"}</dd></div>
            </dl>
            {revision && <StudentProfileEditor profile={{ enrollmentId: student.enrollment_id, fullName: student.full_name,
              displayName: student.display_name, dateOfBirth: student.date_of_birth, maxBirthDate: today,
              gender: student.gender, revision, avatarUrl: avatar }} />}
          </article>;
        })}
      </div> : <div className="student-empty-profile"><h3>Chưa có thông tin lớp học</h3><p>Em hãy liên hệ giáo viên chủ nhiệm để kiểm tra thông tin tài khoản nhé.</p></div>}
      <p className="student-profile-privacy"><ShieldIcon /> Nếu cần sửa họ tên chính thức hoặc thông tin lớp, em hãy nhờ ba mẹ liên hệ giáo viên chủ nhiệm.</p>
      <div className="student-account-bottom-actions">
        <Link className="button button-outline" href="/hoc-sinh/doi-mat-khau" prefetch={false}><ShieldIcon /> Đổi mật khẩu</Link>
      </div>
    </section>
  </main>;
}
