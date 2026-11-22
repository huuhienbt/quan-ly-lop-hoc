import Link from "next/link";
import { ArchiveContentForm, PostEditorForm } from "@/components/content-editor-forms";
import { LessonEditor } from "@/components/lesson-editor";
import { formatContentDate } from "@/components/bulletin";
import { getTeacherEditingPost, getTeacherPostList } from "@/lib/class-content";
import { vietnamToday } from "@/lib/content-schemas";
import { teacherHref, type TeacherPostTab } from "@/lib/teacher-navigation";

const kinds = { NEWS: "Bảng tin", ANNOUNCEMENT: "Thông báo", ACTIVITY: "Hoạt động" };

export async function TeacherPosts({ actorId, classId, tab, create, editId }: {
  actorId: string; classId: string; tab: TeacherPostTab; create: boolean; editId?: string;
}) {
  const [posts, editing] = await Promise.all([
    getTeacherPostList(actorId, classId, tab),
    editId && !create ? getTeacherEditingPost(actorId, classId, tab, editId) : null,
  ]);
  const lesson = tab === "hoc-tap";
  const close = teacherHref(tab, classId);
  const today = vietnamToday();
  // A link to an older item can outlive its place in the recent list.
  const visiblePosts = editing && !posts.some(item => item.id === editing.id)
    ? [{ ...editing, excerpt: editing.body.slice(0, 221) }, ...posts] : posts;

  return <section className="teacher-content-section" id={tab} aria-labelledby="staff-posts-title">
    <div className="teacher-section-heading"><div>
      <h2 id="staff-posts-title">{lesson ? "Bài học của lớp" : "Bảng tin của lớp"}</h2>
    </div></div>
    <div className="teacher-post-create">
      <Link id="staff-create" className="button button-primary" href={create ? close : teacherHref(tab, classId, { create: true })}
        scroll={false} prefetch={false} aria-expanded={create}>
        {create ? "Đóng trình soạn" : lesson ? "+ Thêm bài học" : "+ Thêm bài viết mới"}
      </Link>
      {create && <LessonEditor closeHref={close} key={tab + classId} classId={classId} today={today} mode={lesson ? "lesson" : "bulletin"} />}
    </div>
    {editId && !create && !editing && <p className="teacher-feedback is-error" role="status">Bài đã được lưu trữ hoặc không thuộc mục đang mở.</p>}
    <div className="teacher-items-column">
      {visiblePosts.length ? visiblePosts.map(post => {
        const opened = editing?.id === post.id;
        return <article className="teacher-content-card" key={post.id}>
          <div className="teacher-content-badges">
            <span className={`badge ${post.status === "PUBLISHED" ? "badge-green" : "badge-amber"}`}>{post.status === "PUBLISHED" ? "Đã xuất bản" : "Bản nháp"}</span>
            <span className="badge badge-neutral">{post.visibility === "PUBLIC" ? (lesson ? "Bài cũ công khai" : "Công khai") : "Trong lớp"}</span>
            {post.is_pinned === 1 && <span className="badge badge-amber">Đã ghim</span>}
          </div>
          {!lesson && <p className="teacher-content-category">{kinds[post.kind]}</p>}
          <h3>{post.title}</h3>
          {post.published_at && <p className="teacher-content-meta">Ngày đăng: <time dateTime={post.published_at}>{formatContentDate(post.published_at)}</time></p>}
          <p className="teacher-content-excerpt">{post.excerpt.slice(0, 220)}{post.excerpt.length > 220 ? "…" : ""}</p>
          {!lesson && post.cover_url && <p className="teacher-content-meta">Đã có ảnh bìa</p>}
          <div className="teacher-edit-details">
            <Link id={"staff-edit-" + post.id} className="teacher-edit-link" href={opened ? close : teacherHref(tab, classId, { edit: post.id })}
              prefetch={false} scroll={false} aria-expanded={opened}>
              {opened ? "Đóng chỉnh sửa" : lesson ? "Sửa bài học" : "Chỉnh sửa bài viết"}
            </Link>
            {opened && (lesson && editing.visibility === "PUBLIC"
              ? <PostEditorForm key={editing.id + editing.updated_at} classId={classId} today={today} post={editing} />
              : <LessonEditor closeHref={close} key={editing.id + editing.updated_at} classId={classId} today={today} post={editing} mode={lesson ? "lesson" : "bulletin"} />)}
          </div>
          <ArchiveContentForm type="post" id={post.id} title={post.title} />
        </article>;
      }) : <p className="teacher-empty-content">{lesson ? "Lớp chưa có bài học. Chọn “Thêm bài học” để bắt đầu." : "Lớp chưa có bản tin. Chọn “Thêm bài viết mới” để đăng tin."}</p>}
    </div>
  </section>;
}
