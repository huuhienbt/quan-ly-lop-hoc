import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { ClassroomIllustration } from "@/components/classroom-illustration";
import { DiscoveryHome } from "@/components/discovery-home";
import { HarmonyHome } from "@/components/harmony-home";
import { HomeAccountLink } from "@/components/home-account-link";
import { HomeFooter } from "@/components/home-footer";
import type { HomePageProps } from "@/components/home-page-props";
import { HomeQuiz } from "@/components/home-quiz";
import { PostCard } from "@/components/bulletin";
import { StudentHomeContent } from "@/components/student-home-content";
import { ArrowIcon, ClockIcon, SchoolIcon, SunIcon } from "@/components/icons";
import { getPublicPosts } from "@/lib/class-content";
import type { ContentPost } from "@/lib/content-schemas";
import { getCurrentUser } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";
import { studentHomeLoginLink, studentHomeSection, studentPasswordLink } from "@/lib/student-home";
import { getSiteTheme } from "@/lib/site-theme";
import "./bulletin.css";
import "./discovery-home.css";
import "./harmony-home.css";
import "./home-news.css";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [student, user, { muc, bai }, theme] = await Promise.all([getCurrentStudentAccount(), getCurrentUser(), searchParams, getSiteTheme()]);
  const studentSection = studentHomeSection(muc);
  const section = muc === "do-vui" ? "do-vui" : studentSection;
  if (student?.must_change_password) redirect(studentPasswordLink(studentSection));
  if (!student && studentSection !== "tin-lop") redirect(studentHomeLoginLink(studentSection));
  const firstStudent = student?.students[0];
  const studentName = firstStudent && student?.students.every((profile) => profile.id === firstStudent.id)
    ? firstStudent.full_name.trim()
    : null;
  const accountName = student ? studentName || "Góc học sinh" : user ? user.name.trim() || "Người dùng" : null;
  let posts: ContentPost[] = [];
  let unavailable = false;
  if (!student && section === "tin-lop") {
    try { posts = await getPublicPosts(); } catch { unavailable = true; }
  }
  const studentSignedIn = Boolean(student);
  const classroom = section === "do-vui" ? <HomeQuiz /> : student ? <StudentHomeContent student={student} section={section} theme={theme}
    lessonId={section === "hoc-tap" && typeof bai === "string" ? bai : undefined} /> : null;
  const shared: HomePageProps = { posts, unavailable, accountName, section, studentSignedIn, classroom };

  if (theme === "harmony") {
    return <HarmonyHome {...shared} />;
  }
  if (theme === "discovery") {
    return <DiscoveryHome {...shared} />;
  }

  return <div className="site-shell bulletin-home">
    <div className="bulletin-header-band"><header className="site-header page-width bulletin-header"><Brand /><div className="header-actions"><HomeAccountLink className="button button-primary bulletin-student-link" accountName={accountName} studentSignedIn={studentSignedIn} /></div></header></div>
    <main id="noi-dung">
      <div className="bulletin-hero-sky"><section className="home-hero page-width bulletin-hero" aria-labelledby="home-title"><div className="hero-copy"><p className="eyebrow"><span aria-hidden="true">★</span> MỘT LỚP HỌC · MUÔN NIỀM VUI</p><h1 id="home-title">Mỗi ngày <span className="hero-yellow">đến lớp.</span><br />Một ngày <span className="hero-pink">hạnh phúc.</span></h1><div className="bulletin-hero-actions"><Link className="button button-primary" href={studentSignedIn ? "#loi-tat" : "/dang-nhap"}>Vào lớp học <ArrowIcon /></Link><Link className="button bulletin-hero-secondary" href={section === "tin-lop" ? "#bang-tin" : "/#bang-tin"} prefetch={false}>Xem tin lớp</Link></div><div className="hero-origin"><span className="origin-mark"><SchoolIcon /></span><span>Bắt đầu từ lớp <strong>Bốn 12</strong><br /><span>Trường Tiểu học Bến Tre</span></span></div></div><ClassroomIllustration /></section></div>

      <div className="page-width"><HomeShortcuts activeSection={section} studentSignedIn={studentSignedIn} /></div>
      {classroom ? <div className="page-width">{classroom}</div> : <section className="page-width bulletin-feed bulletin-feed-full" id="bang-tin" aria-labelledby="bulletin-title">
        <div className="bulletin-section-heading"><h2 id="bulletin-title">Tin lớp mình</h2><span className="bulletin-flower" aria-hidden="true">✦</span></div>
        {unavailable ? <div className="bulletin-empty"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Em hãy thử lại sau nhé.</p></div> : posts.length ? <div className="bulletin-card-grid home-news-list">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div> : <div className="bulletin-empty"><SunIcon /><h3>Chưa có tin mới</h3><p>Thầy cô sẽ chia sẻ thông báo và câu chuyện của lớp tại đây.</p></div>}
      </section>}

    </main>
    <HomeFooter />
  </div>;
}
