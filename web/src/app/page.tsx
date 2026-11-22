import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { ClassroomIllustration } from "@/components/classroom-illustration";
import { DiscoveryHome } from "@/components/discovery-home";
import { HarmonyHome } from "@/components/harmony-home";
import { HomeFooter } from "@/components/home-footer";
import { PostCard } from "@/components/bulletin";
import { ArrowIcon, ClockIcon, SchoolIcon, SunIcon } from "@/components/icons";
import { getPublicPosts } from "@/lib/class-content";
import type { ContentPost } from "@/lib/content-schemas";
import { getCurrentUser } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";
import { getSiteTheme } from "@/lib/site-theme";
import "./bulletin.css";
import "./discovery-home.css";
import "./harmony-home.css";
import "./home-news.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [student, user] = await Promise.all([getCurrentStudentAccount(), getCurrentUser()]);
  if (student?.must_change_password) redirect("/hoc-sinh/doi-mat-khau");
  let posts: ContentPost[] = [];
  let unavailable = false;
  try { posts = await getPublicPosts(); } catch { unavailable = true; }

  const theme = await getSiteTheme();
  if (theme === "harmony") {
    return <HarmonyHome posts={posts} unavailable={unavailable} signedIn={Boolean(student || user)} studentSignedIn={Boolean(student)} />;
  }
  if (theme === "discovery") {
    return <DiscoveryHome posts={posts} unavailable={unavailable} signedIn={Boolean(student || user)} studentSignedIn={Boolean(student)} />;
  }

  return <div className="site-shell bulletin-home">
    <div className="bulletin-header-band"><header className="site-header page-width bulletin-header"><Brand classHomepage /><div className="header-actions"><Link className="button button-primary bulletin-student-link" href="/dang-nhap">{user || student ? "Tài khoản" : "Đăng nhập"}<ArrowIcon /></Link></div></header></div>
    <main id="noi-dung">
      <div className="bulletin-hero-sky"><section className="home-hero page-width bulletin-hero" aria-labelledby="home-title"><div className="hero-copy"><p className="eyebrow"><span aria-hidden="true">★</span> MỘT LỚP HỌC · MUÔN NIỀM VUI</p><h1 id="home-title">Mỗi ngày <span className="hero-yellow">đến lớp.</span><br />Một ngày <span className="hero-pink">hạnh phúc.</span></h1><div className="bulletin-hero-actions"><Link className="button button-primary" href={student ? "/hoc-sinh" : "/dang-nhap"}>Vào lớp học <ArrowIcon /></Link><a className="button bulletin-hero-secondary" href="#bang-tin">Xem tin lớp</a></div><div className="hero-origin"><span className="origin-mark"><SchoolIcon /></span><span>Bắt đầu từ lớp <strong>Bốn 12</strong><br /><span>Trường Tiểu học Bến Tre</span></span></div></div><ClassroomIllustration /></section></div>

      <div className="page-width"><HomeShortcuts studentSignedIn={Boolean(student)} /></div>
      <section className="page-width bulletin-feed bulletin-feed-full" id="bang-tin" aria-labelledby="bulletin-title">
        <div className="bulletin-section-heading"><h2 id="bulletin-title">Tin lớp mình</h2><span className="bulletin-flower" aria-hidden="true">✦</span></div>
        {unavailable ? <div className="bulletin-empty"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Em hãy thử lại sau nhé.</p></div> : posts.length ? <div className="bulletin-card-grid home-news-list">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div> : <div className="bulletin-empty"><SunIcon /><h3>Chưa có tin mới</h3><p>Thầy cô sẽ chia sẻ thông báo và câu chuyện của lớp tại đây.</p></div>}
      </section>

    </main>
    <HomeFooter />
  </div>;
}
