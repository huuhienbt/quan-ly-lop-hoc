import Link from "next/link";
import { SiteThemePanel } from "@/components/site-theme-panel";
import { AcademicYearForm, AssignTeacherForm, CreateClassForm, EndAssignmentForm, TeacherReviewForms, UserStatusForm } from "@/components/admin-forms";
import { SchoolIcon, ShieldIcon, SunIcon } from "@/components/icons";
import { getAdminSettings } from "@/lib/admin";
import { schoolSettings, teacherHref, type SchoolSetting } from "@/lib/teacher-navigation";

function localDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export async function TeacherSettings({ section, classId, actorId }: {
  section: SchoolSetting; classId?: string; actorId: string;
}) {
  return <section id="cai-dat" aria-labelledby="staff-settings-title">
    <div className="teacher-section-heading"><div><h2 id="staff-settings-title">Cài đặt toàn trường</h2></div></div>
    <nav className="staff-settings-options" aria-label="Mục cài đặt">
      {schoolSettings.map(item => <Link key={item.id} href={teacherHref("cai-dat", classId, { setting: item.id })}
        scroll={false} prefetch={false} aria-current={section === item.id ? "page" : undefined}>{item.label}</Link>)}
    </nav>
    {section === "giao-dien" ? <SiteThemePanel /> : <SchoolSettingsPanel section={section} actorId={actorId} />}
  </section>;
}

async function SchoolSettingsPanel({ section, actorId }: { section: Exclude<SchoolSetting, "giao-dien">; actorId: string }) {
  const data = await getAdminSettings(section);
  return <>
    {section === "lop-hoc" && (
      <section className="panel" id="lop-hoc" aria-labelledby="classes-title">
              <div className="panel-heading"><div><h2 id="classes-title">Lớp học của trường</h2><p>Theo dõi lớp và giáo viên chủ nhiệm.</p></div><span className="badge badge-neutral">{data.classes.length} lớp</span></div>
              <div className="panel-body">
                {data.classes.length ? data.classes.map((item) => <article className="class-row" key={item.id}>
                  <div className="class-main"><h3 className="class-name">{item.name}</h3><p className="class-year">Khối {item.grade} · Năm học {item.academic_year_name}</p>
                    {item.teacher_name ? <p className="class-teacher">GVCN: {item.teacher_name}</p> : <p className="class-unassigned">Chưa phân công giáo viên chủ nhiệm</p>}
                  </div><span className={`badge ${item.visibility === "PRIVATE" ? "badge-neutral" : "badge-green"}`}>{item.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</span>
                </article>) : <div className="empty-state"><span className="value-icon sage"><SchoolIcon /></span><h3>Lớp học đầu tiên đang chờ thầy cô</h3><p>Chọn “Năm học và lớp học” để tạo lớp, sau đó chọn “Giáo viên và phân công” để giao chủ nhiệm.</p></div>}
              </div>
            </section>
    )}
        {section === "giao-vien" && <div className="admin-columns">
          <div className="admin-column">
            <section className="panel" id="duyet-giao-vien" aria-labelledby="requests-title">
              <div className="panel-heading"><div><h2 id="requests-title">Yêu cầu trở thành giáo viên</h2><p>Kiểm tra tài khoản trước khi cấp quyền.</p></div><span className="badge badge-amber">{data.requests.length} chờ duyệt</span></div>
              <div className="panel-body">
                {data.requests.length ? data.requests.map((request) => <article className="teacher-request" key={request.id}>
                  <div className="request-heading"><span className="small-avatar">{request.name.slice(0, 1).toLocaleUpperCase("vi")}</span><div><strong>{request.name}</strong><p>{request.email}</p></div></div>
                  {request.note && <p className="request-note">{request.note}</p>}
                  <p className="request-date">Gửi ngày {localDate(request.created_at)}</p>
                  <TeacherReviewForms requestId={request.id} name={request.name} />
                </article>) : <div className="empty-state"><span className="value-icon butter"><SunIcon /></span><h3>Không có yêu cầu đang chờ</h3><p>Khi thầy cô đăng nhập lần đầu bằng Google, yêu cầu xét duyệt sẽ xuất hiện tại đây.</p></div>}
              </div>
            </section>

            <section className="panel" aria-labelledby="teachers-title">
              <div className="panel-heading"><div><h2 id="teachers-title">Giáo viên đã được duyệt</h2><p>Các tài khoản có thể được phân công lớp.</p></div></div>
              <div className="panel-body">
                {data.teachers.length ? data.teachers.map((teacher) => <div className="teacher-list-row" key={teacher.id}><span className="small-avatar">{teacher.name.slice(0, 1).toLocaleUpperCase("vi")}</span><div><strong>{teacher.name}</strong><p>{teacher.email}</p></div></div>) : <p className="field-help">Chưa có giáo viên được duyệt. Danh sách sẽ cập nhật sau khi bạn duyệt yêu cầu.</p>}
              </div>
            </section>

            <section className="panel" id="tai-khoan" aria-labelledby="users-title">
              <div className="panel-heading"><div><h2 id="users-title">Quản lý tài khoản</h2><p>Theo dõi quyền và trạng thái truy cập.</p></div><span className="badge badge-neutral">{data.users.length} tài khoản</span></div>
              <div className="panel-body">
                <p className="panel-top-note"><ShieldIcon /> Tạm ngừng tài khoản sẽ kết thúc phân công lớp. Khi mở lại, cần phân công lớp lại.</p>
                <div className="users-list">
                  {data.users.map((account) => <article className="user-row" key={account.id}>
                    <div className="user-details"><strong>{account.name}{account.id === actorId ? " (bạn)" : ""}</strong><p>{account.email}</p><div className="user-badges"><span className="badge badge-neutral">{account.role === "SUPER_ADMIN" ? "Quản trị viên" : account.role === "TEACHER" ? "Giáo viên" : "Chưa được duyệt"}</span><span className={`badge ${account.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{account.status === "ACTIVE" ? "Đang hoạt động" : "Tạm ngừng"}</span></div></div>
                    {account.role !== "SUPER_ADMIN" && account.id !== actorId && <UserStatusForm key={`${account.id}-${account.status}`} userId={account.id} name={account.name} status={account.status} />}
                  </article>)}
                </div>
              </div>
            </section>
          </div>

          <div className="admin-column">
            <section className="panel" id="phan-cong" aria-labelledby="assignment-title">
              <div className="panel-heading"><div><h2 id="assignment-title">Phân công chủ nhiệm</h2><p>Gắn giáo viên đã duyệt với lớp phụ trách.</p></div></div>
              <div className="panel-body"><AssignTeacherForm classes={data.classes} teachers={data.teachers} /></div>
            </section>
            <section className="panel" aria-labelledby="current-assignments-title">
              <div className="panel-heading"><div><h2 id="current-assignments-title">Phân công hiện tại</h2></div></div>
              <div className="panel-body">
                {data.classes.some((item) => item.teacher_id) ? data.classes.map((item) => item.teacher_id && <article className="class-row" key={item.id}>
                  <div className="class-main"><h3 className="class-name">{item.name}</h3><p className="class-teacher">GVCN: {item.teacher_name}</p>
                    <EndAssignmentForm classId={item.id} teacherId={item.teacher_id} className={item.name} />
                  </div>
                </article>) : <p className="field-help">Chưa có phân công đang hoạt động.</p>}
              </div>
            </section>
          </div>
        </div>}
        {section === "nam-hoc" && <div className="admin-columns">
          <div className="admin-column">
            <section className="panel" id="nam-hoc" aria-labelledby="years-title">
              <div className="panel-heading"><div><h2 id="years-title">Năm học</h2><p>Tạo năm học trước khi thêm lớp.</p></div></div>
              <div className="panel-body">
                {data.years.length > 0 && <div>{data.years.map((year) => <div className="year-row" key={year.id}><div><strong>{year.name}</strong><p>{localDate(year.starts_on)} – {localDate(year.ends_on)}</p></div>{year.is_current === 1 && <span className="badge badge-green">Hiện tại</span>}</div>)}</div>}
                <div className={data.years.length ? "form-subsection" : ""}>{data.years.length > 0 && <h3>Thêm năm học</h3>}<AcademicYearForm /></div>
              </div>
            </section>

          </div>
          <div className="admin-column">
            <section className="panel" aria-labelledby="new-class-title">
              <div className="panel-heading"><div><h2 id="new-class-title">Tạo lớp học mới</h2><p>Một không gian mới cho những điều tốt đẹp.</p></div></div>
              <div className="panel-body"><CreateClassForm years={data.years} /></div>
            </section>

          </div>
        </div>}
  </>;
}
