import "server-only";

import Image from "next/image";
import { Suspense } from "react";
import { formatContentDate } from "@/components/bulletin";
import { LessonContent } from "@/components/lesson-render";
import { StudentLessonCard } from "@/components/student-lesson-card";
import { StudentHomeChat } from "@/components/student-home-chat";
import { getStudentHomePosts } from "@/lib/class-content";
import type { ContentPost } from "@/lib/content-schemas";
import { decodeLesson, lessonKinds } from "@/lib/lessons";
import type { StudentHomeSection } from "@/lib/student-home";
import type { StudentAccountSession, StudentLinkedProfile } from "@/lib/student-session";
import "./student-home-content.css";

const titles: Record<StudentHomeSection, string> = {
  "tin-lop": "Tin lớp mình",
  "hoc-tap": "Bài học của lớp",
  "tro-chuyen": "Trò chuyện",
};

function PostBody({ post, lesson = false }: { post: ContentPost; lesson?: boolean }) {
  const blocks = decodeLesson(lesson ? post.lesson_content : post.bulletin_content);
  return <div className="student-home-post-body">
    {post.cover_url && <Image className="student-home-post-cover" src={post.cover_url} alt={post.title} width={960} height={540} unoptimized />}
    {blocks ? <LessonContent blocks={blocks} inlinePdf={lesson} /> : <p>{post.body}</p>}
  </div>;
}

async function ClassPosts({ student, profile, section }: {
  student: StudentAccountSession;
  profile: StudentLinkedProfile;
  section: Exclude<StudentHomeSection, "tro-chuyen">;
}) {
  let posts: ContentPost[];
  try {
    posts = await getStudentHomePosts(student.id, student.session_version, profile.enrollment_id, profile.class_id, section);
  } catch {
    return <p className="student-home-notice" role="status">Chưa tải được nội dung. Em thử tải lại trang nhé.</p>;
  }
  const lesson = section === "hoc-tap";
  if (!posts.length) return <p className="student-home-notice">{lesson ? "Bài học sẽ xuất hiện khi thầy cô đăng." : "Khi có thông báo mới, em sẽ đọc được tại đây."}</p>;

  return <div className="student-home-posts">{posts.map((post) => {
    const dateLabel = post.published_at ? formatContentDate(post.published_at, true) : "";
    if (lesson) return <StudentLessonCard key={post.id} title={post.title} kind={lessonKinds[post.kind]}
      publishedAt={post.published_at} dateLabel={dateLabel}>
      <PostBody post={post} lesson />
    </StudentLessonCard>;
    const kind = post.kind === "ANNOUNCEMENT" ? "Thông báo" : post.category === "PARENT_GUIDE" ? "Gửi ba mẹ" : post.category === "CLASS_STORY" ? "Câu chuyện lớp" : "Tin lớp";
    return <details key={post.id} className="student-news-item">
      <summary>
        <span className="student-content-kicker">{kind}{post.is_pinned ? " · Được ghim" : ""}</span>
        <h3>{post.title}</h3>
        {post.published_at && <time dateTime={post.published_at}>{dateLabel}</time>}
        <span className="student-news-more">Đọc nội dung</span>
      </summary>
      <PostBody post={post} />
    </details>;
  })}</div>;
}

export function StudentHomeContent({ student, section }: { student: StudentAccountSession; section: StudentHomeSection }) {
  const chat = section === "tro-chuyen";
  // Class news and lessons are identical for siblings in the same class.
  const profiles = chat ? student.students : Array.from(new Map(student.students.map((profile) => [profile.class_id, profile])).values());
  return <section id={section === "tin-lop" ? "bang-tin" : "noi-dung-lop"} className={`student-home-content${chat ? " student-home-conversation" : ""}`} aria-labelledby="student-home-title">
    <h2 id="student-home-title">{titles[section]}</h2>
    {!profiles.length && <p className="student-home-notice">Tài khoản chưa liên kết với lớp nào. Em hãy nhờ ba mẹ liên hệ giáo viên chủ nhiệm nhé.</p>}
    {profiles.map((profile) => <div key={profile.enrollment_id} className="student-home-class">
      {profiles.length > 1 && <p className="student-home-class-label">{chat ? `${profile.display_name || profile.full_name} · ${profile.class_name}` : profile.class_name}</p>}
      {chat
        ? <StudentHomeChat classId={profile.class_id} enrollmentId={profile.enrollment_id} />
        : <Suspense fallback={<p className="student-home-notice" role="status">Đang tải nội dung…</p>}>
          <ClassPosts student={student} profile={profile} section={section} />
        </Suspense>}
    </div>)}
  </section>;
}
