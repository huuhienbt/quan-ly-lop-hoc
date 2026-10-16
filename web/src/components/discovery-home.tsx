import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { LearningGameCard } from "@/components/learning-game-card";
import { ThemeSettingsLink } from "@/components/theme-settings-link";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { categoryLabels, formatContentDate } from "@/components/bulletin";
import { ArrowIcon, ClockIcon, HeartIcon, PeopleIcon, SchoolIcon, ShieldIcon, StarIcon, SunIcon } from "@/components/icons";
import { postCategories, type ContentPost, type PostCategory, type PublicBulletin } from "@/lib/content-schemas";
import type { CurrentUser } from "@/lib/rbac";

interface DiscoveryHomeProps {
  bulletin: PublicBulletin;
  unavailable: boolean;
  selected?: PostCategory;
  query: Record<string, string | string[] | undefined>;
  user: CurrentUser | null;
  studentSignedIn: boolean;
  setupReady: boolean;
}

const topicItems = [
  { icon: "📚", title: "Tin lớp", note: "Chuyện của chúng mình", href: "/#bang-tin", color: "butter" },
  { icon: "💛", title: "Điều tử tế", note: "Gieo những điều hay", href: "/#dieu-hay", color: "rose" },
  { icon: "🔎", title: "Góc khám phá", note: "Mở thêm một thế giới", href: "student", color: "sky" },
  { icon: "🌱", title: "Cùng ba mẹ", note: "Vui lớn lên mỗi ngày", href: "/#dong-hanh", color: "mint" },
  { icon: "🗓️", title: "Lịch tuần", note: "Hẹn những ngày vui", href: "/#lich-tuan", color: "peach" },
  { icon: "🎒", title: "Việc hôm nay", note: "Một chút tiến bộ", href: "student", color: "lavender" },
];

function DiscoveryCard({ post }: { post: ContentPost }) {
  return <article className={`discovery-story-card discovery-story-${post.category.toLowerCase()}`}>
    <Link className="discovery-story-cover" href={`/ban-tin/${post.id}`} tabIndex={-1} aria-hidden="true">
      {post.cover_url ? <Image src={post.cover_url} alt="" fill sizes="(max-width: 550px) 100vw, (max-width: 900px) 50vw, 25vw" unoptimized /> : <span className={`discovery-story-art discovery-art-${post.category.toLowerCase()}`} />}
    </Link>
    <div className="discovery-story-body"><div className="discovery-story-meta"><span>{categoryLabels[post.category]}</span>{post.published_at && <time dateTime={post.published_at}>{formatContentDate(post.published_at, true)}</time>}</div><h3><Link href={`/ban-tin/${post.id}`}>{post.title}</Link></h3><p>{post.body}</p><Link className="discovery-text-link" href={`/ban-tin/${post.id}`}>Đọc tiếp <ArrowIcon /></Link></div>
  </article>;
}

function SectionTitle({ id, children, label }: { id: string; children: ReactNode; label?: string }) {
  return <div className="discovery-section-title">{label && <p>{label}</p>}<h2 id={id}><StarIcon /><span>{children}</span><StarIcon /></h2></div>;
}

export function DiscoveryHome({ bulletin, unavailable, selected, query, user, studentSignedIn, setupReady }: DiscoveryHomeProps) {
  const studentHref = studentSignedIn ? "/hoc-sinh" : "/hoc-sinh/dang-nhap";
  const announcements = bulletin.posts.filter((post) => post.kind === "ANNOUNCEMENT").slice(0, 3);
  const feed = bulletin.posts.filter((post) => post.kind !== "ANNOUNCEMENT" && (!selected || post.category === selected)).slice(0, 4);
  const parentPosts = bulletin.posts.filter((post) => post.category === "PARENT_GUIDE").slice(0, 2);
  const kindness = bulletin.posts.find((post) => post.category === "KINDNESS");

  return <div className="discovery-home">
    <header className={`discovery-header${user?.role === "SUPER_ADMIN" ? " has-theme-settings" : ""}`}><div className="discovery-container discovery-header-inner"><Brand /><nav aria-label="Điều hướng chính"><a href="#noi-dung" aria-current="page">Trang chủ</a><a href="#kham-pha">Khám phá</a><a href="#bang-tin">Chuyện lớp</a><a href="#lich-tuan">Lịch tuần</a><a href="#dong-hanh">Ba mẹ</a></nav><div className="discovery-header-actions">{user?.role === "SUPER_ADMIN" && <ThemeSettingsLink />}{user || studentSignedIn ? <SignOutButton /> : <a className="discovery-teacher-link" href="#bat-dau">Thầy cô</a>}<Link className="discovery-button discovery-button-teal" href={studentHref}><StarIcon />{studentSignedIn ? "Góc của em" : "Góc học sinh"}</Link></div></div></header>
    <main id="noi-dung">
      <section className="discovery-hero" aria-labelledby="discovery-home-title"><Image className="discovery-hero-image" src="/images/discovery-hero-3d.webp" alt="" fill sizes="100vw" preload /><div className="discovery-hero-shade" /><div className="discovery-hero-copy"><p className="discovery-hero-eyebrow"><span>✦</span> CHÀO MỪNG ĐẾN VỚI LỚP BỐN 12 <span>✦</span></p><h1 id="discovery-home-title">Để trí tò mò<br /><span>dẫn lối cho em.</span></h1><p>Một lớp học. Muôn điều kỳ diệu.<br />Mỗi ngày đến lớp là một hành trình khám phá!</p><a className="discovery-button discovery-button-yellow" href="#kham-pha">Bắt đầu khám phá <ArrowIcon /></a><span className="discovery-hero-school">Trường Tiểu học Bến Tre</span></div><div className="discovery-hero-bottom" /></section>

      <div className="discovery-container discovery-values" aria-label="Những điều lớp mình cùng vun đắp"><div><ShieldIcon /><span>An toàn & yêu thương</span></div><div><StarIcon /><span>Thầy cô đồng hành</span></div><div><SchoolIcon /><span>Học qua khám phá</span></div><div><HeartIcon /><span>Mỗi ngày một niềm vui</span></div></div>

      <section className="discovery-topics" id="kham-pha" aria-labelledby="discovery-topics-title"><div className="discovery-container"><SectionTitle id="discovery-topics-title">Em muốn khám phá gì?</SectionTitle><p className="discovery-section-intro">Chọn một cánh cửa nhỏ, mở ra những điều hay.</p><div className="discovery-topic-grid">{topicItems.map((topic) => <Link key={topic.title} className={`discovery-topic discovery-topic-${topic.color}`} href={topic.href === "student" ? studentHref : topic.href}><span className="discovery-topic-icon" aria-hidden="true">{topic.icon}</span><strong>{topic.title}</strong><small>{topic.note}</small></Link>)}</div><div className="discovery-topics-spark spark-one" aria-hidden="true">✧</div><div className="discovery-topics-spark spark-two" aria-hidden="true">✦</div></div></section>

      <div className="discovery-container"><LearningGameCard /></div>

      <section className="discovery-container discovery-news" aria-labelledby="discovery-notices-title"><div className="discovery-date-line"><span><span /> LỚP MÌNH HÔM NAY</span><time dateTime={bulletin.today}>{formatContentDate(bulletin.today)}</time></div><div className="discovery-notices"><div className="discovery-notices-heading"><span><ClockIcon /></span><h2 id="discovery-notices-title">Lời nhắn mới</h2></div>{unavailable ? <p role="status">Tạm thời chưa tải được bản tin. Bạn vui lòng quay lại sau ít phút.</p> : announcements.length ? <div className="discovery-notice-items">{announcements.map((post) => <Link href={`/ban-tin/${post.id}`} key={post.id}><span>{post.is_pinned === 1 ? "Đáng chú ý" : post.class_name}</span><strong>{post.title}</strong><ArrowIcon /></Link>)}</div> : <p>Thầy cô sẽ gửi những thông báo mới của lớp tại đây.</p>}</div></section>

      <section className="discovery-stories" id="bang-tin" aria-labelledby="discovery-stories-title"><div className="discovery-container"><SectionTitle id="discovery-stories-title" label="MỖI CÂU CHUYỆN, MỘT ĐIỀU HAY">Những trang chuyện lớp mình</SectionTitle><nav className="discovery-tabs" aria-label="Chủ đề bản tin"><Link href="/#bang-tin" aria-current={!selected ? "page" : undefined}>Tất cả câu chuyện</Link>{postCategories.filter((category) => category !== "GENERAL" && category !== "DISCOVERY").map((category) => <Link key={category} href={`/?muc=${category}#bang-tin`} aria-current={selected === category ? "page" : undefined}>{categoryLabels[category]}</Link>)}</nav>{unavailable ? <div className="discovery-empty" role="status"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Bạn vẫn có thể dùng mục đăng nhập phía dưới.</p></div> : feed.length ? <div className="discovery-story-grid">{feed.map((post) => <DiscoveryCard key={post.id} post={post} />)}</div> : <div className="discovery-empty"><SunIcon /><h3>Câu chuyện mới đang được chuẩn bị</h3><p>Thầy cô sẽ chia sẻ những hoạt động và lời nhắn của lớp tại đây.</p></div>}</div></section>

      <section className="discovery-week-section" aria-labelledby="discovery-week-title"><div className="discovery-container"><SectionTitle id="discovery-week-title">Hẹn những ngày thật vui</SectionTitle><div className="discovery-week-grid"><section className="discovery-calendar" id="lich-tuan" aria-labelledby="discovery-calendar-title"><div className="discovery-calendar-title"><div><span className="discovery-small-label">LỊCH CỦA LỚP MÌNH</span><h3 id="discovery-calendar-title">Tuần này có gì?</h3></div><span className="discovery-calendar-icon"><ClockIcon /></span></div><p className="discovery-week-range">{formatContentDate(bulletin.weekStart, true)} – {formatContentDate(bulletin.weekEnd, true)}</p>{bulletin.events.length ? <ol className="discovery-events">{bulletin.events.map((event) => <li key={event.id}><time dateTime={event.event_date}><strong>{event.event_date.slice(8)}</strong><span>Tháng {Number(event.event_date.slice(5, 7))}</span></time><div><h4>{event.title}</h4><p>{event.class_name}{event.starts_at ? ` · ${event.starts_at}` : ""}</p>{event.body && <p className="discovery-event-body">{event.body}</p>}</div></li>)}</ol> : <div className="discovery-calendar-empty"><span aria-hidden="true">🗓️</span><p>{unavailable ? "Chưa tải được lịch tuần." : "Thầy cô đang cập nhật lịch tuần. Mình cùng chờ thông báo nhé!"}</p></div>}<p className="discovery-calendar-note">Lịch học và hoạt động được thầy cô cập nhật theo tuần.</p></section><section className="discovery-kindness" id="dieu-hay" aria-labelledby="discovery-kindness-title"><span className="discovery-kindness-decoration" aria-hidden="true">✦</span><div className="discovery-kindness-icon"><HeartIcon /></div><p className="discovery-small-label">MỖI TUẦN MỘT ĐIỀU TỐT</p><h3 id="discovery-kindness-title">{kindness?.title ?? "Một lời tử tế, một ngày vui."}</h3><p>{kindness?.body.split("\n").find(Boolean) ?? "Mình cùng lắng nghe, nói lời cảm ơn và dành cho nhau một chút quan tâm mỗi ngày."}</p>{kindness && <Link className="discovery-text-link" href={`/ban-tin/${kindness.id}`}>Mình cùng thực hành <ArrowIcon /></Link>}</section></div></div></section>

      <section className="discovery-container discovery-adventure" aria-labelledby="discovery-adventure-title"><div className="discovery-adventure-art" aria-hidden="true"><span>✦</span></div><div className="discovery-adventure-copy"><p className="discovery-small-label">MỖI NGÀY MỘT CHÚT TIẾN BỘ</p><h2 id="discovery-adventure-title">Một hành trình nhỏ.<br /><span>Bao điều hay đang đợi!</span></h2><p>Đọc thêm một trang sách, hoàn thành một việc nhỏ, chuẩn bị cho ngày mai. Cùng em vui học và lớn lên mỗi ngày.</p><Link className="discovery-button discovery-button-yellow" href={studentHref}>Vào góc học sinh <ArrowIcon /></Link></div><span className="discovery-adventure-spark" aria-hidden="true">✧</span></section>

      <section className="discovery-parents" id="dong-hanh" aria-labelledby="discovery-parents-title"><div className="discovery-container"><SectionTitle id="discovery-parents-title" label="YÊU THƯƠNG LÀ CÙNG NHAU LỚN LÊN">Ba mẹ cùng con khám phá</SectionTitle><p className="discovery-section-intro">Những gợi ý nhỏ để hiểu con hơn, kết nối nhiều hơn.</p>{parentPosts.length ? <div className="discovery-parent-grid">{parentPosts.map((post) => <DiscoveryCard post={post} key={post.id} />)}</div> : <p className="discovery-parent-empty">Những chia sẻ dành cho phụ huynh sẽ được thầy cô cập nhật tại đây.</p>}</div></section>

      <section className="discovery-container discovery-access" id="bat-dau" aria-labelledby="discovery-access-title"><div className="discovery-access-copy"><div className="discovery-access-book" aria-hidden="true">📖<span>✦</span><i>✧</i></div><p className="discovery-small-label">THẦY CÔ KẾT NỐI · LỚP MÌNH LỚN LÊN</p><h2 id="discovery-access-title">Cùng viết tiếp<br /><span>những điều kỳ diệu.</span></h2><p>Thầy cô cập nhật câu chuyện, lịch tuần và những việc cần chuẩn bị để gia đình và nhà trường cùng đồng hành.</p><p className="discovery-privacy-note"><ShieldIcon />Nội dung riêng của lớp dành cho các tài khoản đã được liên kết.</p></div><div className="discovery-account-card">{typeof query.error === "string" && <p className="form-message is-error" role="alert">Chưa thể đăng nhập bằng tài khoản này. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>}{query.access === "denied" && <p className="form-message is-error" role="alert">Tài khoản của bạn chưa có quyền truy cập trang quản trị.</p>}{studentSignedIn ? <><div className="discovery-account-icon"><SunIcon /></div><h3>Chào nhà khám phá nhỏ!</h3><p>Góc học sinh đang chờ em với lời nhắn của thầy cô và những việc nhỏ mỗi ngày.</p><Link className="discovery-button discovery-button-teal" href="/hoc-sinh">Vào góc của em <ArrowIcon /></Link></> : user ? <><div className="discovery-account-avatar">{user.name.slice(0, 1).toLocaleUpperCase("vi")}</div><h3>Xin chào, {user.name}!</h3><p className="discovery-account-email">{user.email}</p>{user.role === "SUPER_ADMIN" || user.role === "TEACHER" ? <><span className="discovery-role-badge">{user.role === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</span><p>Cùng viết tiếp những câu chuyện của lớp thầy cô phụ trách.</p><Link className="discovery-button discovery-button-teal" href="/teacher">Cập nhật bản tin lớp <ArrowIcon /></Link>{user.role === "SUPER_ADMIN" && <Link className="discovery-admin-link" href="/admin">Quản trị trường học <ArrowIcon /></Link>}</> : <><span className="discovery-role-badge discovery-role-pending">Đang chờ xét duyệt</span><p>Liên hệ quản trị viên để được xét duyệt quyền và phân công lớp.</p></>}</> : <><div className="discovery-account-icon"><PeopleIcon /></div><h3>Chào mừng thầy cô</h3><p>Đăng nhập Google để cập nhật những câu chuyện của lớp mình.</p>{!setupReady && <span className="discovery-setup-note">Đăng nhập đang được thiết lập</span>}<GoogleSignInButton enabled={setupReady} /><small>Quyền quản lý được xét duyệt riêng cho từng tài khoản.</small><div className="discovery-student-access">Em là học sinh? <Link href="/hoc-sinh/dang-nhap">Đăng nhập tại đây <ArrowIcon /></Link></div></>}</div></section>
    </main>
    <footer className="discovery-footer"><div className="discovery-container discovery-footer-grid"><div><Brand /><p>Gieo yêu thương. Nuôi hạnh phúc.<br />Cùng em mở những cánh cửa diệu kỳ.</p></div><div><h2>Cùng khám phá</h2><a href="#bang-tin">Bản tin lớp mình</a><a href="#lich-tuan">Lịch tuần</a><Link href={studentHref}>Góc học sinh</Link></div><div><h2>Cùng đồng hành</h2><a href="#dong-hanh">Góc dành cho ba mẹ</a><a href="#bat-dau">Dành cho thầy cô</a><a href="#dieu-hay">Mỗi tuần một điều tốt</a></div><div className="discovery-footer-school"><span><SchoolIcon /></span><strong>Bốn 12</strong><p>Trường Tiểu học Bến Tre</p><a href="#noi-dung">Lên đầu trang <span aria-hidden="true">↑</span></a></div></div><div className="discovery-container discovery-footer-bottom"><p>Lớp học hạnh phúc · Mỗi ngày một hành trình khám phá.</p><span aria-hidden="true">✦</span></div></footer>
  </div>;
}
