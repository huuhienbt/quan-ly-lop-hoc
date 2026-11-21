import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { HomeGalleryPreview } from "@/components/home-gallery-preview";
import { AndroidDownload } from "@/components/android-download";
import { GoogleSignInButton } from "@/components/auth-buttons";
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
  const studentHref = studentSignedIn ? "/hoc-sinh" : "/dang-nhap";
  const feed = bulletin.posts.filter((post) => post.category !== "PARENT_GUIDE" && post.kind !== "ANNOUNCEMENT" && (!selected || post.category === selected)).slice(0, 4);
  const kindness = bulletin.posts.find((post) => post.category === "KINDNESS");

  return <div className="discovery-home">
    <header className="discovery-header"><div className="discovery-container discovery-header-inner"><Brand /><div className="discovery-header-actions"><Link className="discovery-button discovery-button-teal" href="/dang-nhap">{user || studentSignedIn ? "Tài khoản" : "Đăng nhập"}<ArrowIcon /></Link></div></div></header>
    <main id="noi-dung">
      <section className="discovery-hero" aria-labelledby="discovery-home-title"><Image className="discovery-hero-image" src="/images/discovery-hero-3d.webp" alt="" fill sizes="100vw" preload /><div className="discovery-hero-shade" /><div className="discovery-hero-copy"><p className="discovery-hero-eyebrow"><span>✦</span> CHÀO MỪNG ĐẾN VỚI LỚP BỐN 12 <span>✦</span></p><h1 id="discovery-home-title">Để trí tò mò<br /><span>dẫn lối cho em.</span></h1><Link className="discovery-button discovery-button-yellow" href={studentHref}>Vào lớp học <ArrowIcon /></Link><span className="discovery-hero-school">Trường Tiểu học Bến Tre</span></div><div className="discovery-hero-bottom" /></section>

      <div className="discovery-container"><HomeShortcuts studentSignedIn={studentSignedIn} /></div>
      <HomeGalleryPreview />

      <section className="discovery-stories" id="bang-tin" aria-labelledby="discovery-stories-title"><div className="discovery-container"><SectionTitle id="discovery-stories-title" label="MỖI CÂU CHUYỆN, MỘT ĐIỀU HAY">Tin lớp mình</SectionTitle><nav className="discovery-tabs" aria-label="Chủ đề bản tin"><Link href="/#bang-tin" aria-current={!selected ? "page" : undefined}>Tất cả câu chuyện</Link>{postCategories.filter((category) => category !== "GENERAL" && category !== "DISCOVERY" && category !== "PARENT_GUIDE").map((category) => <Link key={category} href={`/?muc=${category}#bang-tin`} aria-current={selected === category ? "page" : undefined}>{categoryLabels[category]}</Link>)}</nav>{unavailable ? <div className="discovery-empty" role="status"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Bạn vẫn có thể dùng mục đăng nhập phía dưới.</p></div> : feed.length ? <div className="discovery-story-grid">{feed.map((post) => <DiscoveryCard key={post.id} post={post} />)}</div> : <div className="discovery-empty"><SunIcon /><h3>Câu chuyện mới đang được chuẩn bị</h3><p>Thầy cô sẽ chia sẻ những hoạt động và lời nhắn của lớp tại đây.</p></div>}</div></section>

      <div className="discovery-kindness-band"><div className="discovery-container"><section className="discovery-kindness" id="dieu-hay" aria-labelledby="discovery-kindness-title"><span className="discovery-kindness-decoration" aria-hidden="true">✦</span><div className="discovery-kindness-icon"><HeartIcon /></div><p className="discovery-small-label">MỖI TUẦN MỘT ĐIỀU TỐT</p><h2 id="discovery-kindness-title">{kindness?.title ?? "Một lời tử tế, một ngày vui."}</h2><p>{kindness?.body.split("\n").find(Boolean) ?? "Mình cùng lắng nghe, nói lời cảm ơn và dành cho nhau một chút quan tâm mỗi ngày."}</p>{kindness && <Link className="discovery-text-link" href={`/ban-tin/${kindness.id}`}>Mình cùng thực hành <ArrowIcon /></Link>}</section></div></div>

      <AndroidDownload />

      <section className="discovery-container discovery-access" id="bat-dau" aria-labelledby="discovery-access-title"><div className="discovery-access-copy"><div className="discovery-access-book" aria-hidden="true">📖<span>✦</span><i>✧</i></div><p className="discovery-small-label">THẦY CÔ KẾT NỐI · LỚP MÌNH LỚN LÊN</p><h2 id="discovery-access-title">Không gian<br /><span>dành cho thầy cô.</span></h2><p>Đăng thông báo, chỉnh thời khóa biểu và trả lời tin nhắn của học sinh.</p><p className="discovery-privacy-note"><ShieldIcon />Nội dung riêng của lớp dành cho các tài khoản đã được liên kết.</p></div><div className="discovery-account-card">{typeof query.error === "string" && <p className="form-message is-error" role="alert">Chưa thể đăng nhập bằng tài khoản này. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>}{query.access === "denied" && <p className="form-message is-error" role="alert">Tài khoản của bạn chưa có quyền truy cập trang quản trị.</p>}{studentSignedIn ? <><div className="discovery-account-icon"><SunIcon /></div><h3>Chào nhà khám phá nhỏ!</h3><p>Đọc tin lớp, khám phá điều hay và trò chuyện cùng thầy cô, bạn bè.</p><Link className="discovery-button discovery-button-teal" href="/hoc-sinh">Vào góc của em <ArrowIcon /></Link></> : user ? <><div className="discovery-account-avatar">{user.name.slice(0, 1).toLocaleUpperCase("vi")}</div><h3>Xin chào, {user.name}!</h3><p className="discovery-account-email">{user.email}</p>{user.role === "SUPER_ADMIN" || user.role === "TEACHER" ? <><span className="discovery-role-badge">{user.role === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</span><p>Cùng viết tiếp những câu chuyện của lớp thầy cô phụ trách.</p><Link className="discovery-button discovery-button-teal" href="/teacher">Cập nhật bản tin lớp <ArrowIcon /></Link>{user.role === "SUPER_ADMIN" && <Link className="discovery-admin-link" href="/admin">Quản trị trường học <ArrowIcon /></Link>}</> : <><span className="discovery-role-badge discovery-role-pending">Đang chờ xét duyệt</span><p>Liên hệ quản trị viên để được xét duyệt quyền và phân công lớp.</p></>}</> : <><div className="discovery-account-icon"><PeopleIcon /></div><h3>Chào mừng thầy cô</h3><p>Đăng nhập Google để cập nhật những câu chuyện của lớp mình.</p>{!setupReady && <span className="discovery-setup-note">Đăng nhập đang được thiết lập</span>}<GoogleSignInButton enabled={setupReady} /><small>Quyền quản lý được xét duyệt riêng cho từng tài khoản.</small><div className="discovery-student-access">Em là học sinh? <Link href="/hoc-sinh/dang-nhap">Đăng nhập tại đây <ArrowIcon /></Link></div></>}</div></section>
    </main>
    <footer className="discovery-footer"><div className="discovery-container discovery-footer-grid"><div><Brand /><p>Gieo yêu thương. Nuôi hạnh phúc.<br />Cùng em mở những cánh cửa diệu kỳ.</p></div><div><h2>Cùng khám phá</h2><a href="#bang-tin">Bản tin lớp mình</a><Link href={studentHref}>Góc học sinh</Link></div><div><h2>Cùng kết nối</h2><Link href={studentSignedIn ? "/hoc-sinh#tro-chuyen" : "/hoc-sinh/dang-nhap"}>Trò chuyện với lớp</Link><a href="#bat-dau">Dành cho thầy cô</a><a href="#dieu-hay">Mỗi tuần một điều tốt</a></div><div className="discovery-footer-school"><span><SchoolIcon /></span><strong>Bốn 12</strong><p>Trường Tiểu học Bến Tre</p><a href="#noi-dung">Lên đầu trang <span aria-hidden="true">↑</span></a></div></div><div className="discovery-container discovery-footer-bottom"><p>Lớp học hạnh phúc · Mỗi ngày một hành trình khám phá.</p><span aria-hidden="true">✦</span></div></footer>
  </div>;
}
