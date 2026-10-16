import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/auth-buttons";
import { ThemeSettingsLink } from "@/components/theme-settings-link";
import { ArchiveContentForm, EventEditorForm, PostEditorForm, TaskEditorForm } from "@/components/content-editor-forms";
import { ClockIcon, SchoolIcon, ShieldIcon, SunIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/rbac";
import { getTeacherContentOverview } from "@/lib/class-content";
import type { PostCategory } from "@/lib/content-schemas";
import { getTeacherTimetable } from "@/lib/class-timetable";
import { TimetableEditor } from "@/components/timetable-editor";
import { ClassChat } from "@/components/class-chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Biên tập nội dung lớp học" };

const categoryLabels: Record<PostCategory, string> = { GENERAL: "Tin chung", CLASS_STORY: "Chuyện lớp mình", KINDNESS: "Điều tử tế", PARENT_GUIDE: "Đồng hành cùng con", DISCOVERY: "Góc khám phá" };
const kindLabels = { NEWS: "Bảng tin", ANNOUNCEMENT: "Thông báo", ACTIVITY: "Hoạt động" };

function dayLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export default async function TeacherPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/#bat-dau");
  if (actor.role !== "TEACHER" && actor.role !== "SUPER_ADMIN") redirect("/?access=denied#bat-dau");
  const overview = await getTeacherContentOverview(actor.id);
  const query = await searchParams;
  const requestedClass = typeof query.class === "string" ? query.class : undefined;
  const selectedClass = overview.classes.find((item) => item.id === requestedClass) ?? overview.classes[0];
  const invalidClass = query.class !== undefined && (!requestedClass || !overview.classes.some((item) => item.id === requestedClass));
  const posts = selectedClass ? overview.posts.filter((item) => item.class_id === selectedClass.id && item.status !== "ARCHIVED") : [];
  const events = selectedClass ? overview.events.filter((item) => item.class_id === selectedClass.id && item.status !== "ARCHIVED") : [];
  const tasks = selectedClass ? overview.tasks.filter((item) => item.class_id === selectedClass.id && item.status !== "ARCHIVED") : [];
  const timetable = selectedClass ? await getTeacherTimetable(actor.id, selectedClass.id) : null;

  return (
    <div className="teacher-shell">
      <header className="teacher-header"><div className="teacher-header-inner page-width"><Brand /><nav aria-label="Điều hướng giáo viên" className="teacher-header-actions"><Link href="/" className="teacher-home-link">Trang chủ</Link>{actor.role === "SUPER_ADMIN" && <><ThemeSettingsLink /><Link className="button button-outline button-small" href="/admin">Quản trị trường</Link></>}<SignOutButton /></nav></div></header>
      <main id="noi-dung" className="teacher-main page-width">
        <div className="teacher-title-row"><div><p className="eyebrow">DÀNH CHO THẦY CÔ</p><h1>Chăm chút từng câu chuyện lớp mình.</h1><p>Chia sẻ bảng tin, hẹn những sự kiện vui và nhắc các em chuẩn bị mỗi ngày.</p></div><span className="teacher-title-sun"><SunIcon /></span></div>
        <div className="teacher-account-line"><span className="badge badge-green"><ShieldIcon />{actor.role === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</span><span>Xin chào, <strong>{actor.name}</strong></span></div>
        {selectedClass ? <>
          <section className="teacher-class-panel" aria-labelledby="teacher-class-title"><div className="teacher-class-copy"><span className="teacher-class-icon"><SchoolIcon /></span><div><h2 id="teacher-class-title">{selectedClass.name}</h2><p>{selectedClass.school_name}</p></div></div><form action="/teacher" method="get" className="teacher-class-switch"><label htmlFor="teacher-class-select">Lớp đang biên tập</label><div><select id="teacher-class-select" name="class" defaultValue={selectedClass.id}>{overview.classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.school_name}</option>)}</select><button type="submit" className="button button-outline button-small">Mở lớp</button></div></form></section>
          {invalidClass && <p className="teacher-feedback is-error" role="alert">Lớp được chọn không thuộc danh sách thầy cô có quyền biên tập. Trang đang hiển thị một lớp trong danh sách được phân công.</p>}
          <nav className="teacher-section-nav" aria-label="Các loại nội dung"><a href="#tro-chuyen">Trò chuyện</a><a href="#thoi-khoa-bieu">Thời khóa biểu</a><a href="#bai-viet">Bảng tin <span>{posts.length}</span></a><a href="#su-kien">Sự kiện <span>{events.length}</span></a><a href="#viec-can-lam">Việc cần làm <span>{tasks.length}</span></a></nav>

          <section className="teacher-content-section" id="tro-chuyen" aria-labelledby="teacher-chat-title"><div className="teacher-section-heading"><div><p className="eyebrow">LẮNG NGHE VÀ ĐỒNG HÀNH</p><h2 id="teacher-chat-title">Trò chuyện với lớp</h2><p>Cùng trao đổi trong phòng chung hoặc trả lời riêng từng học sinh.</p></div></div><div className="teacher-panel"><div className="teacher-panel-body"><ClassChat key={selectedClass.id} mode="teacher" classId={selectedClass.id} /></div></div></section>

          {timetable && <section className="teacher-content-section" id="thoi-khoa-bieu" aria-labelledby="teacher-timetable-title"><div className="teacher-section-heading"><div><p className="eyebrow">MỖI NGÀY ĐẾN LỚP, MỘT NGÀY VUI</p><h2 id="teacher-timetable-title">Thời khóa biểu của lớp</h2><p>Việc ôn bài hôm nay và đồ dùng cho buổi học tới được lấy từ lịch này.</p></div></div><div className="teacher-panel"><div className="teacher-panel-body"><TimetableEditor key={`${selectedClass.id}-${timetable.revision}`} classId={selectedClass.id} timetable={timetable} /></div></div></section>}

          <section className="teacher-content-section" id="bai-viet" aria-labelledby="teacher-posts-title"><div className="teacher-section-heading"><div><p className="eyebrow">GỬI GẮM NHỮNG ĐIỀU TỐT ĐẸP</p><h2 id="teacher-posts-title">Bảng tin của lớp</h2></div><span className="teacher-section-note">Bản nháp chỉ dành cho người biên tập.</span></div><div className="teacher-content-columns"><div className="teacher-panel"><div className="teacher-panel-heading"><h3>Bài viết mới</h3><p>Viết cho học sinh, ba mẹ và cộng đồng của lớp.</p></div><div className="teacher-panel-body"><PostEditorForm key={selectedClass.id} classId={selectedClass.id} /></div></div><div className="teacher-items-column">
            {posts.length ? posts.map((post) => <article className="teacher-content-card" key={post.id}><div className="teacher-content-badges"><span className={`badge ${post.status === "PUBLISHED" ? "badge-green" : "badge-amber"}`}>{post.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}</span><span className="badge badge-neutral">{post.visibility === "PUBLIC" ? "Công khai" : "Trong lớp"}</span>{post.is_pinned === 1 && <span className="badge badge-amber">Đã ghim</span>}</div><p className="teacher-content-category">{kindLabels[post.kind]} · {categoryLabels[post.category]}</p><h3>{post.title}</h3><p className="teacher-content-excerpt">{post.body.slice(0, 220)}{post.body.length > 220 ? "…" : ""}</p>{post.cover_url && <p className="teacher-content-meta">Đã có ảnh bìa</p>}<details className="teacher-edit-details"><summary>Chỉnh sửa bài viết</summary><PostEditorForm key={`${post.id}-${post.updated_at}`} classId={selectedClass.id} post={post} /></details><ArchiveContentForm type="post" id={post.id} title={post.title} /></article>) : <div className="teacher-empty-content"><span className="teacher-empty-icon"><SunIcon /></span><h3>Câu chuyện đầu tiên đang chờ thầy cô</h3><p>Thêm một lời chào, một thông báo hoặc một hoạt động đáng nhớ của lớp.</p></div>}
          </div></div></section>

          <section className="teacher-content-section" id="su-kien" aria-labelledby="teacher-events-title"><div className="teacher-section-heading"><div><p className="eyebrow">CÙNG NHAU HẸN NHỮNG NIỀM VUI</p><h2 id="teacher-events-title">Sự kiện và lịch của lớp</h2></div></div><div className="teacher-content-columns"><div className="teacher-panel"><div className="teacher-panel-heading"><h3>Sự kiện mới</h3><p>Những ngày các em cần ghi nhớ.</p></div><div className="teacher-panel-body"><EventEditorForm key={selectedClass.id} classId={selectedClass.id} today={overview.today} /></div></div><div className="teacher-items-column">
            {events.length ? events.map((event) => <article className="teacher-content-card" key={event.id}><div className="teacher-content-badges"><span className={`badge ${event.status === "PUBLISHED" ? "badge-green" : "badge-amber"}`}>{event.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}</span><span className="badge badge-neutral">{event.visibility === "PUBLIC" ? "Công khai" : "Trong lớp"}</span></div><p className="teacher-event-date"><ClockIcon />{dayLabel(event.event_date)}{event.starts_at ? ` · ${event.starts_at}` : ""}</p><h3>{event.title}</h3>{event.body && <p className="teacher-content-excerpt">{event.body.slice(0, 220)}{event.body.length > 220 ? "…" : ""}</p>}<details className="teacher-edit-details"><summary>Chỉnh sửa sự kiện</summary><EventEditorForm key={`${event.id}-${event.updated_at}`} classId={selectedClass.id} today={overview.today} event={event} /></details><ArchiveContentForm type="event" id={event.id} title={event.title} /></article>) : <div className="teacher-empty-content"><span className="teacher-empty-icon"><ClockIcon /></span><h3>Chưa có sự kiện nào</h3><p>Thêm lịch sinh hoạt, hoạt động hoặc ngày hẹn quan trọng để lớp cùng chuẩn bị.</p></div>}
          </div></div></section>

          <section className="teacher-content-section" id="viec-can-lam" aria-labelledby="teacher-tasks-title"><div className="teacher-section-heading"><div><p className="eyebrow">TỪNG BƯỚC NHỎ, MỖI NGÀY TỐT HƠN</p><h2 id="teacher-tasks-title">Việc cần làm và chuẩn bị ngày mai</h2></div></div><div className="teacher-content-columns"><div className="teacher-panel"><div className="teacher-panel-heading"><h3>Nhắc việc mới</h3><p>Hướng dẫn ngắn gọn để các em dễ thực hiện.</p></div><div className="teacher-panel-body"><TaskEditorForm key={selectedClass.id} classId={selectedClass.id} /></div></div><div className="teacher-items-column">
            {tasks.length ? tasks.map((task) => <article className="teacher-content-card" key={task.id}><div className="teacher-content-badges"><span className="badge badge-green">{task.kind === "TODO" ? "Việc cần làm" : "Chuẩn bị ngày mai"}</span><span className="badge badge-neutral">Trong lớp</span></div><p className="teacher-content-category">{task.task_date ? dayLabel(task.task_date) : "Lặp lại hằng ngày"} · Thứ tự {task.sort_order}</p><h3>{task.title}</h3>{task.details && <p className="teacher-content-excerpt">{task.details.slice(0, 220)}{task.details.length > 220 ? "…" : ""}</p>}<details className="teacher-edit-details"><summary>Chỉnh sửa công việc</summary><TaskEditorForm key={`${task.id}-${task.updated_at}`} classId={selectedClass.id} task={task} /></details><ArchiveContentForm type="task" id={task.id} title={task.title} /></article>) : <div className="teacher-empty-content"><span className="teacher-empty-icon"><SchoolIcon /></span><h3>Cùng tạo những thói quen tốt</h3><p>Thêm một việc cần làm hoặc đồ dùng cần chuẩn bị. Những lời nhắc này chỉ hiển thị trong lớp.</p></div>}
          </div></div></section>
        </> : <section className="teacher-no-class"><span className="teacher-empty-icon"><SchoolIcon /></span><h2>Chưa có lớp để biên tập</h2><p>{actor.role === "SUPER_ADMIN" ? "Tạo lớp học trong trang quản trị để bắt đầu chia sẻ nội dung với học sinh và ba mẹ." : "Thầy cô hãy liên hệ quản trị viên để được phân công lớp. Nội dung của lớp sẽ xuất hiện tại đây sau khi được phân công."}</p>{actor.role === "SUPER_ADMIN" && <Link className="button button-primary" href="/admin">Mở trang quản trị</Link>}</section>}
        <footer className="teacher-footer">Lớp học hạnh phúc · Mỗi ngày đến lớp, một ngày vui.</footer>
      </main>
    </div>
  );
}
