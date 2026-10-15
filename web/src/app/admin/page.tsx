import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/auth-buttons";
import { SiteThemePanel } from "@/components/site-theme-panel";
import { AcademicYearForm, AssignTeacherForm, CreateClassForm, EndAssignmentForm, TeacherReviewForms, UserStatusForm } from "@/components/admin-forms";
import { ClockIcon, PeopleIcon, SchoolIcon, ShieldIcon, SunIcon } from "@/components/icons";
import { getAdminOverview } from "@/lib/admin";
import { AuthorizationError, requireSuperAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản trị trường học" };

function localDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export default async function AdminPage() {
  let user;
  try { user = await requireSuperAdmin(); }
  catch (error) {
    if (error instanceof AuthorizationError) redirect(error.status === 401 ? "/#bat-dau" : "/?access=denied#bat-dau");
    throw error;
  }
  const data = await getAdminOverview();

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner page-width">
          <Brand />
          <nav className="admin-header-actions" aria-label="Tài khoản quản trị">
            <span className="badge badge-green"><ShieldIcon /> Quản trị viên</span>
            <Link className="nav-link" href="/">Trang chủ</Link>
            <Link className="button button-outline button-small" href="/teacher">Biên tập nội dung lớp</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="admin-main page-width" id="noi-dung">
        <div className="admin-title-row">
          <div><p className="eyebrow">{data.school.name.toLocaleUpperCase("vi")}</p><h1>Không gian quản trị</h1><p className="page-description">Cùng chuẩn bị nền tảng cho những lớp học hạnh phúc.</p></div>
          <div className="admin-welcome">Xin chào,<strong>{user.name}</strong></div>
        </div>
        <SiteThemePanel />
        <div className="stats-grid">
          <div className="stat-card"><span className="value-icon sage"><SchoolIcon /></span><div><span className="stat-number">{data.classes.length}</span><span className="stat-label">Lớp học đang hoạt động</span></div></div>
          <div className="stat-card"><span className="value-icon peach"><PeopleIcon /></span><div><span className="stat-number">{data.teachers.length}</span><span className="stat-label">Giáo viên đã được duyệt</span></div></div>
          <div className="stat-card"><span className="value-icon butter"><ClockIcon /></span><div><span className="stat-number">{data.requests.length}</span><span className="stat-label">Yêu cầu chờ xét duyệt</span></div></div>
        </div>
        <nav className="admin-nav" aria-label="Các mục quản trị"><a href="#giao-dien">Giao diện</a><a href="#lop-hoc">Lớp học</a><a href="#duyet-giao-vien">Duyệt giáo viên</a><a href="#nam-hoc">Năm học</a><a href="#phan-cong">Phân công chủ nhiệm</a><a href="#tai-khoan">Tài khoản</a></nav>

        <div className="admin-columns">
          <div className="admin-column">
            <section className="panel" id="lop-hoc" aria-labelledby="classes-title">
              <div className="panel-heading"><div><h2 id="classes-title">Lớp học của trường</h2><p>Theo dõi lớp và giáo viên chủ nhiệm.</p></div><span className="badge badge-neutral">{data.classes.length} lớp</span></div>
              <div className="panel-body">
                {data.classes.length ? data.classes.map((item) => <article className="class-row" key={item.id}>
                  <div className="class-main"><h3 className="class-name">{item.name}</h3><p className="class-year">Khối {item.grade} · Năm học {item.academic_year_name}</p>
                    {item.teacher_name ? <p className="class-teacher">GVCN: {item.teacher_name}</p> : <p className="class-unassigned">Chưa phân công giáo viên chủ nhiệm</p>}
                    {item.teacher_id && <EndAssignmentForm classId={item.id} teacherId={item.teacher_id} className={item.name} />}
                  </div><span className={`badge ${item.visibility === "PRIVATE" ? "badge-neutral" : "badge-green"}`}>{item.visibility === "PRIVATE" ? "Riêng tư" : "Công khai"}</span>
                </article>) : <div className="empty-state"><span className="value-icon sage"><SchoolIcon /></span><h3>Lớp học đầu tiên đang chờ thầy cô</h3><p>Tạo năm học, thêm lớp Bốn 12, rồi phân công giáo viên chủ nhiệm để bắt đầu.</p></div>}
              </div>
            </section>

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
                    <div className="user-details"><strong>{account.name}{account.id === user.id ? " (bạn)" : ""}</strong><p>{account.email}</p><div className="user-badges"><span className="badge badge-neutral">{account.role === "SUPER_ADMIN" ? "Quản trị viên" : account.role === "TEACHER" ? "Giáo viên" : "Chưa được duyệt"}</span><span className={`badge ${account.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{account.status === "ACTIVE" ? "Đang hoạt động" : "Tạm ngừng"}</span></div></div>
                    {account.role !== "SUPER_ADMIN" && account.id !== user.id && <UserStatusForm key={`${account.id}-${account.status}`} userId={account.id} name={account.name} status={account.status} />}
                  </article>)}
                </div>
              </div>
            </section>
          </div>

          <div className="admin-column">
            <section className="panel" id="nam-hoc" aria-labelledby="years-title">
              <div className="panel-heading"><div><h2 id="years-title">Năm học</h2><p>Tạo năm học trước khi thêm lớp.</p></div></div>
              <div className="panel-body">
                {data.years.length > 0 && <div>{data.years.map((year) => <div className="year-row" key={year.id}><div><strong>{year.name}</strong><p>{localDate(year.starts_on)} – {localDate(year.ends_on)}</p></div>{year.is_current === 1 && <span className="badge badge-green">Hiện tại</span>}</div>)}</div>}
                <div className={data.years.length ? "form-subsection" : ""}>{data.years.length > 0 && <h3>Thêm năm học</h3>}<AcademicYearForm /></div>
              </div>
            </section>

            <section className="panel" aria-labelledby="new-class-title">
              <div className="panel-heading"><div><h2 id="new-class-title">Tạo lớp học mới</h2><p>Một không gian mới cho những điều tốt đẹp.</p></div></div>
              <div className="panel-body"><CreateClassForm years={data.years} /></div>
            </section>

            <section className="panel" id="phan-cong" aria-labelledby="assignment-title">
              <div className="panel-heading"><div><h2 id="assignment-title">Phân công chủ nhiệm</h2><p>Gắn giáo viên đã duyệt với lớp phụ trách.</p></div></div>
              <div className="panel-body"><AssignTeacherForm classes={data.classes} teachers={data.teachers} /></div>
            </section>
          </div>
        </div>
        <p className="admin-footer">Lớp học hạnh phúc · Gieo yêu thương, nuôi hạnh phúc</p>
      </main>
    </div>
  );
}
