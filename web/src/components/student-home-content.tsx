import "server-only";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { formatContentDate, PostCard } from "@/components/bulletin";
import { DiscoveryCard } from "@/components/discovery-home";
import { HarmonyStoryCard } from "@/components/harmony-home";
import { LessonContent } from "@/components/lesson-render";
import { StudentHomeChat } from "@/components/student-home-chat";
import { getStudentHomePosts, getStudentLessonPost } from "@/lib/class-content";
import type { ContentPost } from "@/lib/content-schemas";
import { decodeLesson, lessonKinds } from "@/lib/lessons";
import type { StudentHomeSection } from "@/lib/student-home";
import type { StudentAccountSession, StudentLinkedProfile } from "@/lib/student-session";
import type { SiteTheme } from "@/lib/theme-schemas";
import "./student-home-content.css";

const titles: Record<StudentHomeSection, string> = {
  "tin-lop": "Tin lớp mình",
  "hoc-tap": "Bài học của lớp",
  "tro-chuyen": "Trò chuyện",
};

function LessonBody({ post }: { post: ContentPost }) {
  const blocks = decodeLesson(post.lesson_content);
  return <div className="student-home-post-body">
    {post.cover_url && <Image className="student-home-post-cover" src={post.cover_url} alt={post.title} width={960} height={540} unoptimized />}
    {blocks ? <LessonContent blocks={blocks} inlinePdf /> : <p>{post.body}</p>}
  </div>;
}

async function OpenLesson({ student, lessonId }: { student: StudentAccountSession; lessonId: string }) {
  let post: ContentPost | null;
  try {
    post = await getStudentLessonPost(student.id, student.session_version, lessonId);
  } catch {
    return <p className="student-home-notice" role="status">Chưa tải được bài học. Em hãy thử lại nhé.</p>;
  }
  if (!post) return <p className="student-home-notice">Bài học không còn hoặc chưa được giao cho lớp của em.</p>;
  return <article className="student-open-lesson">
    <header><span>{lessonKinds[post.kind]} · {post.class_name}</span><h3>{post.title}</h3>
      {post.published_at && <time dateTime={post.published_at}>{formatContentDate(post.published_at)}</time>}
    </header>
    <LessonBody post={post} />
  </article>;
}

async function ClassPosts({ student, profile, section, theme }: {
  student: StudentAccountSession;
  profile: StudentLinkedProfile;
  section: Exclude<StudentHomeSection, "tro-chuyen">;
  theme: SiteTheme;
}) {
  let posts: ContentPost[];
  try {
    posts = await getStudentHomePosts(student.id, student.session_version, profile.enrollment_id, profile.class_id, section);
  } catch {
    return <p className="student-home-notice" role="status">Chưa tải được nội dung. Em thử tải lại trang nhé.</p>;
  }
  const lesson = section === "hoc-tap";
  if (!posts.length) return <p className="student-home-notice">{lesson ? "Bài học sẽ xuất hiện khi thầy cô đăng." : "Khi có thông báo mới, em sẽ đọc được tại đây."}</p>;

  const Card = theme === "discovery" ? DiscoveryCard : theme === "harmony" ? HarmonyStoryCard : PostCard;
  const grid = theme === "discovery" ? "discovery-story-grid" : theme === "harmony" ? "harmony-story-grid" : "bulletin-card-grid";
  return <div className={`${grid} home-news-list`}>{posts.map(post => <Card key={post.id} post={post} lesson={lesson} />)}</div>;
}

export function StudentHomeContent({ student, section, theme, lessonId }: { student: StudentAccountSession; section: StudentHomeSection; theme: SiteTheme; lessonId?: string }) {
  const chat = section === "tro-chuyen";
  const openedLesson = section === "hoc-tap" && lessonId;
  // Class news and lessons are identical for siblings in the same class.
  const profiles = chat ? student.students : Array.from(new Map(student.students.map((profile) => [profile.class_id, profile])).values());
  return <section id={section === "tin-lop" ? "bang-tin" : "noi-dung-lop"} className={`student-home-content${chat ? " student-home-conversation" : ""}`} aria-labelledby="student-home-title">
    <h2 id="student-home-title">{titles[section]}</h2>
    {openedLesson ? <>
      <Link className="student-lesson-back" href="/?muc=hoc-tap#noi-dung-lop" prefetch={false}>← Về danh sách bài học</Link>
      <Suspense key={openedLesson} fallback={<p className="student-home-notice" role="status">Đang mở bài học…</p>}>
        <OpenLesson student={student} lessonId={openedLesson} />
      </Suspense>
    </> : <>
    {!profiles.length && <p className="student-home-notice">Tài khoản chưa liên kết với lớp nào. Em hãy nhờ ba mẹ liên hệ giáo viên chủ nhiệm nhé.</p>}
    {profiles.map((profile) => <div key={profile.enrollment_id} className="student-home-class">
      {profiles.length > 1 && <p className="student-home-class-label">{chat ? `${profile.full_name} · ${profile.class_name}` : profile.class_name}</p>}
      {chat
        ? <StudentHomeChat classId={profile.class_id} enrollmentId={profile.enrollment_id} />
        : <Suspense fallback={<p className="student-home-notice" role="status">Đang tải nội dung…</p>}>
          <ClassPosts student={student} profile={profile} section={section} theme={theme} />
        </Suspense>}
    </div>)}</>}
  </section>;
}
