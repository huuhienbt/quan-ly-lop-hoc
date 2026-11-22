import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/auth-buttons";
import { ArchiveContentForm, PostEditorForm } from "@/components/content-editor-forms";
import { SchoolIcon, ShieldIcon, SunIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/rbac";
import { getTeacherContentOverview } from "@/lib/class-content";
import type { PostCategory } from "@/lib/content-schemas";
import { formatContentDate } from "@/components/bulletin";
import { LessonEditor } from "@/components/lesson-editor";
import { ClassChat } from "@/components/class-chat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Biên tập nội dung lớp học" };

const categoryLabels: Record<PostCategory, string> = { GENERAL: "Tin chung", CLASS_STORY: "Chuyện lớp mình", KINDNESS: "Điều tử tế", PARENT_GUIDE: "Đồng hành cùng con", DISCOVERY: "Góc khám phá" };
const kindLabels = { NEWS: "Bảng tin", ANNOUNCEMENT: "Thông báo", ACTIVITY: "Hoạt động" };

export default async function TeacherPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/dang-nhap?vai=giaovien");
  if (actor.role !== "TEACHER" && actor.role !== "SUPER_ADMIN") redirect("/dang-nhap?vai=giaovien");
  const query = await searchParams;
  const tab = query.tab === "tro-chuyen" || query.tab === "hoc-tap" ? query.tab : "bai-viet";
  const overview = await getTeacherContentOverview(actor.id, { includeLegacy: false });
  const requestedClass = typeof query.class === "string" ? query.class : undefined;
  const selectedClass = overview.classes.find((item) => item.id === requestedClass) ?? overview.classes[0];
  const invalidClass = query.class !== undefined && (!requestedClass || !overview.classes.some((item) => item.id === requestedClass));
  const posts = selectedClass && tab !== "tro-chuyen" ? overview.posts.filter((item) =>
    item.class_id === selectedClass.id && item.status !== "ARCHIVED" && (item.category === "DISCOVERY") === (tab === "hoc-tap")) : [];
  const classQuery = selectedClass ? `class=${encodeURIComponent(selectedClass.id)}&` : "";

  return (
    <div className="teacher-shell">
      <header className="teacher-header"><div className="teacher-header-inner page-width"><Brand /><nav aria-label="Điều hướng giáo viên" className="teacher-header-actions"><Link href="/" className="teacher-home-link">Trang chủ</Link>{actor.role === "SUPER_ADMIN" && <Link className="button button-outline button-small" href="/admin?caiDat=1#cai-dat">Cài đặt nâng cao</Link>}<SignOutButton /></nav></div></header>
      <main id="noi-dung" className="teacher-main page-width">
        <h1 className="sr-only">Biên tập nội dung lớp học</h1>
        <div className="teacher-account-line"><span className="badge badge-green"><ShieldIcon />{actor.role === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</span><span>Xin chào, <strong>{actor.name}</strong></span></div>
        {selectedClass ? <>
          <section className="teacher-class-panel" aria-labelledby="teacher-class-title"><div className="teacher-class-copy"><span className="teacher-class-icon"><SchoolIcon /></span><div><h2 id="teacher-class-title">{selectedClass.name}</h2><p>{selectedClass.school_name}</p></div></div>{overview.classes.length > 1 && <form action="/teacher" method="get" className="teacher-class-switch"><input type="hidden" name="tab" value={tab} /><label htmlFor="teacher-class-select">Lớp đang biên tập</label><div><select id="teacher-class-select" name="class" defaultValue={selectedClass.id}>{overview.classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.school_name}</option>)}</select><button type="submit" className="button button-outline button-small">Mở lớp</button></div></form>}</section>
          {invalidClass && <p className="teacher-feedback is-error" role="alert">Lớp được chọn không thuộc danh sách thầy cô có quyền biên tập. Trang đang hiển thị một lớp trong danh sách được phân công.</p>}
          <nav className="teacher-section-nav" aria-label="Công việc thường dùng">
            <Link href={`/teacher?${classQuery}tab=bai-viet`} aria-current={tab === "bai-viet" ? "page" : undefined}>Bài viết</Link>
            <Link href={`/teacher?${classQuery}tab=hoc-tap`} aria-current={tab === "hoc-tap" ? "page" : undefined}>Học tập</Link>
            <Link href={`/teacher?${classQuery}tab=tro-chuyen`} aria-current={tab === "tro-chuyen" ? "page" : undefined}>Trò chuyện</Link>
          </nav>
          {tab === "bai-viet" ? <section className="teacher-content-section" id="bai-viet" aria-labelledby="teacher-posts-title"><div className="teacher-section-heading"><div><p className="eyebrow">GỬI GẮM NHỮNG ĐIỀU TỐT ĐẸP</p><h2 id="teacher-posts-title">Bảng tin của lớp</h2></div><span className="teacher-section-note">Bản nháp chỉ dành cho người biên tập.</span></div><details className="teacher-post-create">
            <summary className="button button-primary"><span className="teacher-post-create-icon" aria-hidden="true">+</span> Thêm bài viết mới</summary>
            <LessonEditor key={selectedClass.id} classId={selectedClass.id} today={overview.today} mode="bulletin" />
          </details>
          <div className="teacher-items-column">
            {posts.length ? posts.map((post) => <article className="teacher-content-card" key={post.id}><div className="teacher-content-badges"><span className={`badge ${post.status === "PUBLISHED" ? "badge-green" : "badge-amber"}`}>{post.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}</span><span className="badge badge-neutral">{post.visibility === "PUBLIC" ? "Công khai" : "Trong lớp"}</span>{post.is_pinned === 1 && <span className="badge badge-amber">Đã ghim</span>}</div><p className="teacher-content-category">{kindLabels[post.kind]} · {categoryLabels[post.category]}</p><h3>{post.title}</h3>{post.published_at && <p className="teacher-content-meta">Ngày đăng: <time dateTime={post.published_at}>{formatContentDate(post.published_at)}</time></p>}<p className="teacher-content-excerpt">{post.body.slice(0, 220)}{post.body.length > 220 ? "…" : ""}</p>{post.cover_url && <p className="teacher-content-meta">Đã có ảnh bìa</p>}<details className="teacher-edit-details"><summary>Chỉnh sửa bài viết</summary><LessonEditor key={`${post.id}-${post.updated_at}`} classId={selectedClass.id} today={overview.today} post={post} mode="bulletin" /></details><ArchiveContentForm type="post" id={post.id} title={post.title} /></article>) : <div className="teacher-empty-content"><span className="teacher-empty-icon"><SunIcon /></span><h3>Câu chuyện đầu tiên đang chờ thầy cô</h3><p>Thêm một lời chào, một thông báo hoặc một hoạt động đáng nhớ của lớp.</p></div>}
          </div></section>

          : tab === "hoc-tap" ? <section className="teacher-content-section" id="hoc-tap" aria-labelledby="teacher-lesson-title">
            <div className="teacher-section-heading"><div><h2 id="teacher-lesson-title">Bài học của lớp</h2><p>Bài đã xuất bản hiển thị trong mục Học tập của học sinh.</p></div></div>
            <details className="teacher-post-create">
              <summary className="button button-primary"><span aria-hidden="true">＋</span> Thêm bài học</summary>
              <LessonEditor key={selectedClass.id} classId={selectedClass.id} today={overview.today} />
            </details>
            <div className="teacher-items-column">
              {posts.length ? posts.map(post => <article className="teacher-content-card" key={post.id}>
                <div className="teacher-content-badges"><span className={post.status === "PUBLISHED" ? "badge badge-green" : "badge badge-amber"}>{post.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}</span><span className="badge badge-neutral">{post.visibility === "PUBLIC" ? "Bài cũ công khai" : "Trong lớp"}</span></div>
                <h3>{post.title}</h3>{post.published_at && <p className="teacher-content-meta">Ngày đăng: <time dateTime={post.published_at}>{formatContentDate(post.published_at)}</time></p>}<p className="teacher-content-excerpt">{post.body.slice(0, 180)}</p>
                <details className="teacher-edit-details"><summary>Sửa bài học</summary>
                  {post.visibility === "PUBLIC" ? <PostEditorForm key={post.updated_at} classId={selectedClass.id} post={post} today={overview.today} />
                    : <LessonEditor key={post.updated_at} classId={selectedClass.id} today={overview.today} post={post} />}
                </details>
                <ArchiveContentForm type="post" id={post.id} title={post.title} />
              </article>) : <p className="teacher-content-excerpt">Lớp chưa có bài học. Chọn Thêm bài học để bắt đầu.</p>}
            </div>
          </section>
          : <section className="teacher-content-section" id="tro-chuyen" aria-labelledby="teacher-chat-title"><div className="teacher-section-heading"><div><p className="eyebrow">LẮNG NGHE VÀ ĐỒNG HÀNH</p><h2 id="teacher-chat-title">Trò chuyện với lớp</h2><p>Cùng trao đổi trong phòng chung hoặc trả lời riêng từng học sinh.</p></div></div><ClassChat key={selectedClass.id} mode="teacher" classId={selectedClass.id} /></section>}

        </> : <section className="teacher-no-class"><span className="teacher-empty-icon"><SchoolIcon /></span><h2>Chưa có lớp để biên tập</h2><p>{actor.role === "SUPER_ADMIN" ? "Tạo lớp học trong trang quản trị để bắt đầu chia sẻ nội dung với học sinh và ba mẹ." : "Thầy cô hãy liên hệ quản trị viên để được phân công lớp. Nội dung của lớp sẽ xuất hiện tại đây sau khi được phân công."}</p>{actor.role === "SUPER_ADMIN" && <Link className="button button-primary" href="/admin">Mở trang quản trị</Link>}</section>}
        <footer className="teacher-footer">Lớp học hạnh phúc · Mỗi ngày đến lớp, một ngày vui.</footer>
      </main>
    </div>
  );
}
