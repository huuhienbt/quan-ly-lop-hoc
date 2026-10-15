import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@/components/auth-buttons";
import { ClockIcon, HeartIcon, SchoolIcon, ShieldIcon, SunIcon } from "@/components/icons";
import { StudentTaskList } from "@/components/student-task-list";
import { getStudentClassContent } from "@/lib/class-content";
import type { ClassEvent, ContentPost, StudentClassSpace } from "@/lib/content-schemas";
import { requireStudentPageAccount } from "./student-access";
import "./content.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Góc học sinh" };

const genderLabels: Record<string, string> = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác", UNSPECIFIED: "Chưa cập nhật" };

function dateOfBirth(value: string | null) {
  if (!value) return "Chưa cập nhật";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${value}T12:00:00+07:00`));
}

function vietnamDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(new Date(value));
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)?.value).join("-");
}

function postDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "";
}

function weekDates(start: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function WeekAgenda({ events, weekStart, today }: { events: ClassEvent[]; weekStart: string; today: string }) {
  const labels = ["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];
  return <div className="student-week-grid">{weekDates(weekStart).map((day, index) => {
    const items = events.filter((event) => event.event_date === day);
    return <div className={`student-week-day${day === today ? " is-today" : ""}`} key={day}>
      <span className="student-week-label">{labels[index]}{day === today && <span className="sr-only">, hôm nay</span>}</span>
      <time className="student-week-number" dateTime={day}>{shortDate(day)}</time>
      <div className="student-week-events">{items.length ? items.map((event) => <article className="student-week-event" key={event.id}>
        {event.starts_at && <span>{event.starts_at}</span>}<h4>{event.title}</h4>{event.body && <p>{event.body}</p>}
      </article>) : <span className="student-week-empty">Chưa có lịch</span>}</div>
    </div>;
  })}</div>;
}

function ClassNews({ posts }: { posts: ContentPost[] }) {
  return <div className="student-news-list">{posts.map((post) => <details className="student-news-item" key={post.id}>
    <summary><span className="student-content-kicker">{post.kind === "ANNOUNCEMENT" ? "Thông báo" : post.category === "PARENT_GUIDE" ? "Gửi ba mẹ" : post.category === "CLASS_STORY" ? "Câu chuyện lớp" : "Tin lớp"}{post.is_pinned ? " · Được ghim" : ""}</span><h4>{post.title}</h4>{post.published_at && <time dateTime={post.published_at}>{postDate(post.published_at)}</time>}<span className="student-news-more">Đọc nội dung <span aria-hidden="true">↗</span></span></summary>
    <p className="student-content-body">{post.body}</p>
  </details>)}</div>;
}

function StudentLearningSpace({ space, today, tomorrow, weekStart, weekEnd }: { space: StudentClassSpace; today: string; tomorrow: string; weekStart: string; weekEnd: string }) {
  const prefix = `lop-${space.enrollment_id}`;
  const news = space.posts.filter((post) => post.category !== "DISCOVERY" && post.category !== "KINDNESS");
  const discovery = space.posts.filter((post) => post.category === "DISCOVERY");
  const kindnessPosts = space.posts.filter((post) => post.category === "KINDNESS");
  const thisWeekKindness = kindnessPosts.filter((post) =>
    vietnamDate(post.published_at || post.created_at) >= weekStart && vietnamDate(post.published_at || post.created_at) <= weekEnd);
  const kindness = thisWeekKindness.length ? thisWeekKindness : kindnessPosts.slice(0, 1);
  const tasks = space.tasks.filter((task) => task.kind === "TODO" && (!task.task_date || task.task_date === today));
  const preparation = space.tasks.filter((task) => task.kind === "PREPARATION" && (!task.task_date || task.task_date === tomorrow));

  return <section className="student-learning-space" aria-labelledby={`${prefix}-title`}>
    <div className="student-learning-heading"><span className="student-profile-avatar" aria-hidden="true">{space.student_name.slice(0, 1).toLocaleUpperCase("vi")}</span><div><p className="student-learning-label">KHÔNG GIAN CỦA EM</p><h2 id={`${prefix}-title`}>{space.student_name}</h2><p>{space.class_name} · {space.school_name}</p></div></div>
    <nav className="student-content-nav" aria-label={`Góc học tập của ${space.student_name}`}><a href={`#${prefix}-today`}>Việc hôm nay</a><a href={`#${prefix}-prepare`}>Chuẩn bị ngày mai</a><a href={`#${prefix}-week`}>Lịch tuần</a><a href={`#${prefix}-news`}>Tin lớp</a><a href={`#${prefix}-discovery`}>Khám phá</a></nav>

    <section className="student-content-panel student-week-panel" id={`${prefix}-week`} aria-labelledby={`${prefix}-week-title`}>
      <div className="student-content-panel-heading"><div className="student-content-heading-group"><span className="student-content-icon tone-blue"><ClockIcon /></span><div><h3 id={`${prefix}-week-title`}>Tuần của lớp em</h3><p className="student-content-panel-copy">Những hoạt động thầy cô đã hẹn cùng lớp.</p></div></div><span className="student-content-date">{shortDate(weekStart)} — {shortDate(weekEnd)}</span></div>
      {!space.events.length && <p className="student-today-note">Thầy cô chưa cập nhật lịch cho tuần này.</p>}
      <WeekAgenda events={space.events} weekStart={weekStart} today={today} />
    </section>

    <div className="student-content-layout"><div className="student-content-main">
      <section className="student-content-panel student-today-panel" id={`${prefix}-today`} aria-labelledby={`${prefix}-today-title`}>
        <div className="student-content-panel-heading"><div className="student-content-heading-group"><span className="student-content-icon tone-green"><SunIcon /></span><div><h3 id={`${prefix}-today-title`}>Hôm nay em làm gì?</h3><p className="student-content-panel-copy">Từng việc nhỏ, em làm theo nhịp của mình nhé.</p></div></div><span className="student-content-date">{shortDate(today)}</span></div>
        {tasks.length ? <StudentTaskList tasks={tasks} enrollmentId={space.enrollment_id} today={today} /> : <p className="student-content-empty">Thầy cô chưa giao việc cho hôm nay. Em có thể ghé góc khám phá trong lúc chờ nhé.</p>}
      </section>

      <section className="student-content-panel student-news-panel" id={`${prefix}-news`} aria-labelledby={`${prefix}-news-title`}>
        <div className="student-content-panel-heading"><div className="student-content-heading-group"><span className="student-content-icon tone-peach"><SchoolIcon /></span><div><h3 id={`${prefix}-news-title`}>Tin từ lớp em</h3><p className="student-content-panel-copy">Lời nhắn và những câu chuyện mới của lớp.</p></div></div></div>
        {news.length ? <ClassNews posts={news} /> : <p className="student-content-empty">Khi thầy cô có thông báo mới, em sẽ đọc được tại đây.</p>}
      </section>

      <section className="student-content-panel student-discovery-panel" id={`${prefix}-discovery`} aria-labelledby={`${prefix}-discovery-title`}>
        <div className="student-content-panel-heading"><div className="student-content-heading-group"><span className="student-content-icon tone-blue"><DiscoveryIcon /></span><div><h3 id={`${prefix}-discovery-title`}>Mỗi ngày một điều hay</h3><p className="student-content-panel-copy">Mở một câu chuyện, gặp một điều mới.</p></div></div></div>
        {discovery.length ? <div className="student-article-list">{discovery.map((post) => <details className="student-article-card" key={post.id}><summary><span className="student-content-kicker">Góc khám phá</span><h4>{post.title}</h4><span className="student-news-more">Cùng tìm hiểu <span aria-hidden="true">↗</span></span></summary><p className="student-content-body">{post.body}</p></details>)}</div> : <p className="student-content-empty">Những bài khám phá sẽ xuất hiện khi thầy cô đăng. Em nhớ quay lại nhé.</p>}
      </section>
    </div><aside className="student-content-side" aria-label={`Lời nhắc cho ${space.student_name}`}>
      <section className="student-content-panel student-prepare-panel" id={`${prefix}-prepare`} aria-labelledby={`${prefix}-prepare-title`}>
        <div className="student-content-panel-heading"><div className="student-content-heading-group"><span className="student-content-icon tone-gold"><BagIcon /></span><div><h3 id={`${prefix}-prepare-title`}>Chiếc cặp ngày mai</h3><p className="student-content-panel-copy">Chuẩn bị cho ngày {shortDate(tomorrow)}.</p></div></div></div>
        {preparation.length ? <ol className="student-preparation-list">{preparation.map((task) => <li key={task.id}><strong>{task.title}</strong>{task.details && <p className="student-content-body">{task.details}</p>}</li>)}</ol> : <p className="student-content-empty">Thầy cô chưa có lời nhắc chuẩn bị cho ngày mai.</p>}
      </section>

      <section className="student-content-panel student-kindness-panel" aria-labelledby={`${prefix}-kindness-title`}>
        <div className="student-content-panel-heading"><div className="student-content-heading-group"><span className="student-content-icon tone-gold"><HeartIcon /></span><div><h3 id={`${prefix}-kindness-title`}>Một điều tử tế tuần này</h3><p className="student-content-panel-copy">Việc nhỏ hôm nay, niềm vui ngày mai.</p></div></div></div>
        {kindness.length ? kindness.map((post) => <article className="student-kindness-body" key={post.id}><h4>{post.title}</h4><p className="student-content-body">{post.body}</p></article>) : <p className="student-content-empty">Lời nhắn tử tế của tuần sẽ được thầy cô gửi tới em tại đây.</p>}
      </section>
    </aside></div>
  </section>;
}

function DiscoveryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5c3-1 5.7-.5 8 1.2 2.3-1.7 5-2.2 8-1.2V19c-3-1-5.7-.5-8 1.2C9.7 18.5 7 18 4 19V5.5Zm8 1.2v13.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BagIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="6" width="14" height="15" rx="4" stroke="currentColor" strokeWidth="1.7" /><path d="M9 6V5a3 3 0 0 1 6 0v1M8.5 14h7v4h-7zM5 11h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default async function StudentHomePage() {
  const account = await requireStudentPageAccount();
  const content = await getStudentClassContent(account.id, account.session_version);
  const firstStudent = account.students[0];
  const greeting = account.students.length === 1 && firstStudent ? `Chào ${firstStudent.display_name || firstStudent.full_name}!` : "Chào mừng đến với góc học sinh!";

  return (
    <main id="noi-dung" className="student-dashboard-main student-content-page page-width">
      <div className="student-page-toolbar"><p className="eyebrow">LỚP HỌC HẠNH PHÚC · GÓC HỌC SINH</p><SignOutButton /></div>
      <section className="student-dashboard-welcome" aria-labelledby="student-dashboard-title"><div className="student-welcome-copy"><span className="badge badge-green">Một ngày đến lớp, một ngày vui</span><h1 id="student-dashboard-title">{greeting}</h1><p>Cùng chuẩn bị cho một ngày học nhẹ nhàng và nhiều điều hay.</p><p className="student-content-intro"><time dateTime={content.today}>{new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${content.today}T12:00:00+07:00`))}</time></p></div><div className="student-welcome-art" aria-hidden="true"><Image className="student-welcome-illustration" src="/images/happy-school-3d.webp" alt="" width={1536} height={1024} sizes="(max-width: 760px) 1px, 280px" /><span className="student-welcome-spark student-welcome-spark-one">✦</span><span className="student-welcome-spark student-welcome-spark-two">✦</span></div></section>
      {!content.students.length && <section className="student-content-panel student-empty-profile"><h2>Chưa có không gian lớp học</h2><p>Em hãy nhờ ba mẹ liên hệ giáo viên chủ nhiệm để kiểm tra thông tin liên kết tài khoản nhé.</p></section>}
      {content.students.map((space) => <StudentLearningSpace key={space.enrollment_id} space={space} today={content.today} tomorrow={content.tomorrow} weekStart={content.weekStart} weekEnd={content.weekEnd} />)}
      <details className="student-profile-disclosure"><summary>Thông tin học sinh và tài khoản</summary><section className="student-profiles-section" aria-labelledby="student-profiles-title">
        <div className="student-profile-heading"><h2 id="student-profiles-title">Thông tin học sinh</h2><Link className="button button-outline button-small" href="/hoc-sinh/doi-mat-khau"><ShieldIcon /> Đổi mật khẩu</Link></div>
        {account.students.length ? <div className="student-profiles-grid">{account.students.map((student) => <article className="student-profile-card" key={`${student.id}-${student.class_id}`}>
          <div className="student-profile-top"><span className="student-profile-avatar" aria-hidden="true">{student.full_name.slice(0, 1).toLocaleUpperCase("vi")}</span><div><h3>{student.full_name}</h3><p>{student.school_name}</p></div></div>
          <dl className="student-profile-details"><div><dt>Lớp học</dt><dd>{student.class_name}</dd></div><div><dt>Năm học</dt><dd>{student.academic_year_name}</dd></div><div><dt>Ngày sinh</dt><dd>{dateOfBirth(student.date_of_birth)}</dd></div><div><dt>Giới tính</dt><dd>{genderLabels[student.gender] ?? "Chưa cập nhật"}</dd></div></dl>
        </article>)}</div> : <div className="student-empty-profile"><h3>Chưa có thông tin lớp học</h3><p>Em hãy liên hệ giáo viên chủ nhiệm để kiểm tra thông tin tài khoản nhé.</p></div>}
        <p className="student-profile-privacy"><ShieldIcon /> Nếu thông tin cần điều chỉnh, em hãy nhờ ba mẹ liên hệ giáo viên chủ nhiệm.</p>
      </section></details>
    </main>
  );
}
