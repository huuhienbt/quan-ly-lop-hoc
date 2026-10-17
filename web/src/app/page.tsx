import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { AndroidDownload } from "@/components/android-download";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { ClassroomIllustration } from "@/components/classroom-illustration";
import { DiscoveryHome } from "@/components/discovery-home";
import { HarmonyHome } from "@/components/harmony-home";
import { PostCard, categoryLabels, formatContentDate } from "@/components/bulletin";
import { ArrowIcon, ClockIcon, HeartIcon, PeopleIcon, SchoolIcon, ShieldIcon, StarIcon, SunIcon } from "@/components/icons";
import { getPublicBulletin } from "@/lib/class-content";
import { getVietnamDateWindow, postCategories, type PublicBulletin } from "@/lib/content-schemas";
import { getSetupState } from "@/lib/config";
import { getCurrentUser } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";
import { getSiteTheme } from "@/lib/site-theme";
import { ThemeSettingsLink } from "@/components/theme-settings-link";
import "./bulletin.css";
import "./discovery-home.css";
import "./harmony-home.css";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const setup = getSetupState();
  const student = await getCurrentStudentAccount();
  if (student?.must_change_password) redirect("/hoc-sinh/doi-mat-khau");
  const user = await getCurrentUser();
  const query = await searchParams;
  let bulletin: PublicBulletin = { ...getVietnamDateWindow(), posts: [], events: [] };
  let unavailable = !setup.databaseReady;
  if (setup.databaseReady) {
    try { bulletin = await getPublicBulletin(); } catch { unavailable = true; }
  }
  const selected = postCategories.find((value) => value !== "PARENT_GUIDE" && value === query.muc);
  bulletin = { ...bulletin, posts: bulletin.posts.filter((post) => post.category !== "PARENT_GUIDE") };
  const announcements = bulletin.posts.filter((post) => post.kind === "ANNOUNCEMENT").slice(0, 3);
  const feed = bulletin.posts.filter((post) => post.kind !== "ANNOUNCEMENT" && (!selected || post.category === selected));
  const kindness = bulletin.posts.find((post) => post.category === "KINDNESS");
  const authError = typeof query.error === "string";

  const theme = await getSiteTheme();
  if (theme === "harmony") {
    return <HarmonyHome bulletin={bulletin} unavailable={unavailable} selected={selected} query={query} user={user} studentSignedIn={Boolean(student)} setupReady={setup.ready} />;
  }
  if (theme === "discovery") {
    return <DiscoveryHome bulletin={bulletin} unavailable={unavailable} selected={selected} query={query} user={user} studentSignedIn={Boolean(student)} setupReady={setup.ready} />;
  }

  return <div className="site-shell bulletin-home">
    <div className="bulletin-header-band"><header className="site-header page-width bulletin-header"><Brand /><nav className="header-actions" aria-label="Điều hướng chính"><a className="nav-link" href="#bang-tin">Bảng tin</a><a className="nav-link" href="#lich-tuan">Lịch tuần</a><a className="nav-link" href="#loi-tat">Lối vào nhanh</a>{user?.role === "SUPER_ADMIN" && <ThemeSettingsLink />}{user || student ? <SignOutButton /> : <a className="nav-link bulletin-staff-link" href="#bat-dau">Thầy cô</a>}<Link className="button button-primary bulletin-student-link" href={student ? "/hoc-sinh" : "/hoc-sinh/dang-nhap"}>{student ? "Góc của em" : "Góc học sinh"}<ArrowIcon /></Link></nav></header></div>
    <main id="noi-dung">
      <div className="bulletin-hero-sky"><section className="home-hero page-width bulletin-hero" aria-labelledby="home-title"><div className="hero-copy"><p className="eyebrow"><span aria-hidden="true">★</span> MỘT LỚP HỌC · MUÔN NIỀM VUI</p><h1 id="home-title">Mỗi ngày <span className="hero-yellow">đến lớp.</span><br />Một ngày <span className="hero-pink">hạnh phúc.</span></h1><p className="hero-description">Xem việc cần làm, chuẩn bị bài và trò chuyện cùng lớp mình.</p><div className="bulletin-hero-actions"><Link className="button button-primary" href={student ? "/hoc-sinh" : "/hoc-sinh/dang-nhap"}>Vào góc học sinh <ArrowIcon /></Link><a className="button bulletin-hero-secondary" href="#bang-tin">Xem tin lớp</a></div><div className="hero-origin"><span className="origin-mark"><SchoolIcon /></span><span>Bắt đầu từ lớp <strong>Bốn 12</strong><br /><span>Trường Tiểu học Bến Tre</span></span></div></div><ClassroomIllustration /></section></div>

      <div className="page-width"><HomeShortcuts studentSignedIn={Boolean(student)} /></div>

      <div className="page-width bulletin-date-line"><span><span className="status-dot" /> KẾT NỐI YÊU THƯƠNG MỖI NGÀY</span><time dateTime={bulletin.today}>{formatContentDate(bulletin.today)}</time></div>
      <section className="page-width bulletin-notices" aria-labelledby="notices-title"><h2 id="notices-title"><span className="bulletin-notice-icon"><ClockIcon /></span>Thông báo mới</h2>{unavailable ? <p role="status">Tạm thời chưa tải được bản tin. Bạn vui lòng quay lại sau ít phút.</p> : announcements.length ? <div className="bulletin-notice-list">{announcements.map((post) => <Link key={post.id} href={`/ban-tin/${post.id}`} className="bulletin-notice"><span>{post.is_pinned === 1 ? "Đáng chú ý" : post.class_name}</span><strong>{post.title}</strong><ArrowIcon /></Link>)}</div> : <p>Thông báo mới sẽ xuất hiện tại đây khi thầy cô đăng bài.</p>}</section>

      <div className="page-width bulletin-columns"><section className="bulletin-feed" id="bang-tin" aria-labelledby="bulletin-title"><div className="bulletin-section-heading"><div><p className="eyebrow"><StarIcon /> GÓC BẢN TIN LỚP MÌNH</p><h2 id="bulletin-title">Chuyện nhỏ, <span>niềm vui to!</span></h2></div><span className="bulletin-flower" aria-hidden="true">✦</span></div><nav className="bulletin-tabs" aria-label="Chủ đề bản tin"><Link href="/#bang-tin" aria-current={!selected ? "page" : undefined}>Tất cả</Link>{postCategories.filter((category) => category !== "GENERAL" && category !== "DISCOVERY" && category !== "PARENT_GUIDE").map((category) => <Link key={category} href={`/?muc=${category}#bang-tin`} aria-current={selected === category ? "page" : undefined}>{categoryLabels[category]}</Link>)}</nav>
        {unavailable ? <div className="bulletin-empty"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Bạn vẫn có thể dùng mục đăng nhập phía dưới.</p></div> : feed.length ? <div className="bulletin-card-grid">{feed.map((post) => <PostCard key={post.id} post={post} />)}</div> : <div className="bulletin-empty"><SunIcon /><h3>Câu chuyện mới đang được chuẩn bị</h3><p>Thầy cô sẽ chia sẻ những hoạt động và lời nhắn của lớp tại đây.</p></div>}
      </section><aside className="bulletin-sidebar"><section className="bulletin-week-card" id="lich-tuan" aria-labelledby="week-title"><div className="bulletin-sidebar-heading"><span className="bulletin-small-icon"><ClockIcon /></span><h2 id="week-title">Tuần này có gì?</h2></div><p className="bulletin-week-range">{formatContentDate(bulletin.weekStart, true)} – {formatContentDate(bulletin.weekEnd, true)}</p>{bulletin.events.length ? <ol className="bulletin-event-list">{bulletin.events.map((event) => <li key={event.id}><time dateTime={event.event_date}><strong>{event.event_date.slice(8)}</strong><span>Tháng {Number(event.event_date.slice(5, 7))}</span></time><div><h3>{event.title}</h3><p>{event.class_name}{event.starts_at ? ` · ${event.starts_at}` : ""}</p>{event.body && <p className="bulletin-event-description">{event.body}</p>}</div></li>)}</ol> : <div className="bulletin-week-empty"><span aria-hidden="true">☀</span><p>{unavailable ? "Chưa tải được lịch tuần." : "Thầy cô đang cập nhật lịch tuần. Mình cùng chờ thông báo nhé!"}</p></div>}<p className="bulletin-week-note">Lịch học và hoạt động được thầy cô cập nhật theo tuần.</p></section>
        <section className="bulletin-kindness-card" id="dieu-hay" aria-labelledby="kindness-title"><span className="bulletin-kindness-heart"><HeartIcon /></span><p className="eyebrow">MỖI TUẦN MỘT ĐIỀU TỐT</p><h2 id="kindness-title">{kindness?.title ?? "Một lời tử tế, một ngày vui."}</h2><p>{kindness?.body.split("\n").find(Boolean) ?? "Mình cùng lắng nghe, nói lời cảm ơn và dành cho nhau một chút quan tâm mỗi ngày."}</p>{kindness && <Link href={`/ban-tin/${kindness.id}`}>Cùng thực hành <ArrowIcon /></Link>}</section>
      </aside></div>

      <AndroidDownload />

      <section id="bat-dau" className="access-section page-width bulletin-access" aria-labelledby="access-title"><div className="access-intro"><p className="eyebrow">THẦY CÔ KẾT NỐI · LỚP MÌNH LỚN LÊN</p><h2 id="access-title">Không gian<br />dành cho thầy cô.</h2><p>Đăng thông báo, chỉnh thời khóa biểu và trả lời tin nhắn của học sinh.</p><p className="privacy-note"><ShieldIcon /> Nội dung riêng của lớp dành cho các tài khoản đã được liên kết.</p></div><div className="access-card">
        {authError && <p className="form-message is-error" role="alert">Chưa thể đăng nhập bằng tài khoản này. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>}{query.access === "denied" && <p className="form-message is-error" role="alert">Tài khoản của bạn chưa có quyền truy cập trang quản trị.</p>}
        {student ? <><div className="access-icon"><SunIcon /></div><h3>Góc học sinh đang chờ em</h3><p className="access-description">Xem lời nhắn của thầy cô và chuẩn bị cho một ngày học thật vui.</p><Link className="button button-primary full-width" href="/hoc-sinh">Vào góc của em <ArrowIcon /></Link></> : user ? <><div className="account-avatar">{user.name.slice(0, 1).toLocaleUpperCase("vi")}</div><p className="card-kicker">RẤT VUI ĐƯỢC GẶP THẦY CÔ</p><h3>Xin chào, {user.name}!</h3><p className="account-email">{user.email}</p>{user.role === "SUPER_ADMIN" || user.role === "TEACHER" ? <><span className="badge badge-green">{user.role === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</span><p className="access-description">Cập nhật nội dung cho các lớp thầy cô phụ trách.</p><Link className="button button-primary full-width" href="/teacher">Cập nhật bản tin lớp <ArrowIcon /></Link>{user.role === "SUPER_ADMIN" && <Link className="bulletin-admin-link" href="/admin">Quản trị trường học</Link>}</> : <><span className="badge badge-amber"><ClockIcon /> Đang chờ xét duyệt</span><p className="access-description">Liên hệ quản trị viên để được xét duyệt quyền và phân công lớp.</p></>}</> : <><div className="access-icon"><PeopleIcon /></div><h3>Chào mừng thầy cô</h3><p className="access-description">Đăng nhập Google để cập nhật<br />những câu chuyện của lớp mình.</p>{!setup.ready && <p className="setup-note"><span className="status-dot" /> Đăng nhập đang được thiết lập</p>}<GoogleSignInButton enabled={setup.ready} /><p className="sign-in-note">Quyền quản lý được xét duyệt riêng cho từng tài khoản.</p><p className="student-home-access">Em là học sinh? <Link href="/hoc-sinh/dang-nhap">Đăng nhập tại đây <ArrowIcon /></Link></p></>}
      </div></section>
    </main><div className="bulletin-footer-band"><footer className="site-footer page-width bulletin-footer"><Brand compact /><p>Gieo yêu thương · Nuôi hạnh phúc<br /><span>Bốn 12 · Trường Tiểu học Bến Tre</span></p><a href="#noi-dung" className="bulletin-footer-top">Lên đầu trang ↑</a></footer></div>
  </div>;
}
