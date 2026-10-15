import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { categoryLabels, formatContentDate } from "@/components/bulletin";
import { ArrowIcon, ClockIcon, HeartIcon, PeopleIcon, SchoolIcon, ShieldIcon, StarIcon, SunIcon } from "@/components/icons";
import { ThemeSettingsLink } from "@/components/theme-settings-link";
import { postCategories, type ContentPost, type PostCategory, type PublicBulletin } from "@/lib/content-schemas";
import type { CurrentUser } from "@/lib/rbac";

export interface HarmonyHomeProps {
  bulletin: PublicBulletin;
  unavailable: boolean;
  selected?: PostCategory;
  query: Record<string, string | string[] | undefined>;
  user: CurrentUser | null;
  studentSignedIn: boolean;
  setupReady: boolean;
}

const shortcuts = [
  { icon: "📚", title: "Tin lớp", note: "Chuyện mới của chúng mình", href: "/#bang-tin", color: "sky" },
  { icon: "🗓️", title: "Lịch tuần", note: "Sẵn sàng cho ngày vui", href: "/#lich-tuan", color: "mint" },
  { icon: "🎒", title: "Việc hôm nay", note: "Mỗi ngày một chút tiến bộ", href: "student", color: "butter" },
  { icon: "🌟", title: "Góc của em", note: "Một thế giới để khám phá", href: "student", color: "rose" },
];

function HarmonyStoryCard({ post, compact = false }: { post: ContentPost; compact?: boolean }) {
  return (
    <article className={`harmony-story-card${compact ? " is-compact" : ""}`}>
      <Link className="harmony-story-cover" href={`/ban-tin/${post.id}`} tabIndex={-1} aria-hidden="true">
        {post.cover_url ? (
          <Image src={post.cover_url} alt="" fill sizes="(max-width: 650px) 100vw, (max-width: 1000px) 50vw, 34vw" unoptimized />
        ) : <span className={`harmony-story-art harmony-art-${post.category.toLowerCase()}`} />}
      </Link>
      <div className="harmony-story-body">
        <div className="harmony-story-meta">
          <span>{categoryLabels[post.category]}</span>
          {post.published_at && <time dateTime={post.published_at}>{formatContentDate(post.published_at, true)}</time>}
        </div>
        <h3><Link href={`/ban-tin/${post.id}`}>{post.title}</Link></h3>
        <p>{post.body}</p>
        <Link className="harmony-text-link" href={`/ban-tin/${post.id}`}>Đọc câu chuyện <ArrowIcon /></Link>
      </div>
    </article>
  );
}

export function HarmonyHome({ bulletin, unavailable, selected, query, user, studentSignedIn, setupReady }: HarmonyHomeProps) {
  const studentHref = studentSignedIn ? "/hoc-sinh" : "/hoc-sinh/dang-nhap";
  const announcements = bulletin.posts.filter((post) => post.kind === "ANNOUNCEMENT").slice(0, 3);
  const stories = bulletin.posts.filter((post) => post.kind !== "ANNOUNCEMENT" && (!selected || post.category === selected)).slice(0, 4);
  const parentPosts = bulletin.posts.filter((post) => post.category === "PARENT_GUIDE").slice(0, 2);
  const kindness = bulletin.posts.find((post) => post.category === "KINDNESS");

  return (
    <div className="harmony-home">
      <header className={`harmony-header${user?.role === "SUPER_ADMIN" ? " has-theme-settings" : ""}`}>
        <div className="harmony-container harmony-header-inner">
          <Brand />
          <nav aria-label="Điều hướng chính"><a href="#bang-tin">Tin lớp</a><a href="#lich-tuan">Lịch tuần</a><a href="#dong-hanh">Ba mẹ đồng hành</a></nav>
          <div className="harmony-header-actions">
            {user?.role === "SUPER_ADMIN" && <ThemeSettingsLink />}
            {user || studentSignedIn ? <SignOutButton /> : <a className="harmony-staff-link" href="#bat-dau">Dành cho thầy cô</a>}
            <Link className="harmony-button harmony-button-yellow" href={studentHref}><StarIcon />{studentSignedIn ? "Góc của em" : "Góc học sinh"}</Link>
          </div>
        </div>
      </header>

      <main id="noi-dung">
        <section className="harmony-hero-wrap" aria-labelledby="harmony-home-title">
          <div className="harmony-container harmony-hero">
            <div className="harmony-hero-copy">
              <p className="harmony-eyebrow"><span /> LỚP BỐN 12 · TRƯỜNG TIỂU HỌC BẾN TRE</p>
              <h1 id="harmony-home-title">Vui học hôm nay.<br /><span>Khám phá ngày mai.</span></h1>
              <p className="harmony-hero-description">Một lớp học. Muôn điều hạnh phúc.<span className="harmony-hero-detail"><br />Cùng em học điều hay, làm việc tốt và mở thêm những cánh cửa mới mỗi ngày.</span></p>
              <Link className="harmony-button harmony-button-yellow harmony-hero-cta" href={studentHref}>Vào góc học sinh <ArrowIcon /></Link>
              <p className="harmony-hero-note"><HeartIcon /> Mỗi em đều được lắng nghe và yêu thương.</p>
            </div>
            <div className="harmony-hero-art">
              <div className="harmony-hero-frame"><Image src="/images/discovery-hero-3d.webp" alt="Các bạn nhỏ cùng khám phá những hòn đảo thư viện và chú rồng đang đọc sách." fill sizes="(max-width: 760px) 100vw, 50vw" preload /></div>
              <span className="harmony-art-spark harmony-spark-one" aria-hidden="true">✦</span>
              <span className="harmony-art-spark harmony-spark-two" aria-hidden="true">✧</span>
              <div className="harmony-art-note"><span aria-hidden="true">🌱</span><span>Một chút tò mò.<br /><strong>Bao điều hay!</strong></span></div>
            </div>
          </div>
        </section>

        <section className="harmony-container harmony-today" aria-labelledby="harmony-notices-title">
          <div className="harmony-day-line"><p><SunIcon /> LỚP MÌNH HÔM NAY</p><time dateTime={bulletin.today}>{formatContentDate(bulletin.today)}</time></div>
          <div className="harmony-notices">
            <div className="harmony-notice-heading"><span><ClockIcon /></span><h2 id="harmony-notices-title">Lời nhắn mới</h2></div>
            {unavailable ? <p className="harmony-notice-empty" role="status">Tạm thời chưa tải được thông báo. Bạn vui lòng quay lại sau ít phút.</p> : announcements.length ? (
              <div className="harmony-notice-items">{announcements.map((post) => <Link href={`/ban-tin/${post.id}`} key={post.id}><span>{post.is_pinned === 1 ? "Đáng chú ý" : post.class_name}</span><strong>{post.title}</strong><ArrowIcon /></Link>)}</div>
            ) : <p className="harmony-notice-empty">Thầy cô sẽ gửi những thông báo mới của lớp tại đây.</p>}
          </div>
          <nav className="harmony-shortcuts" aria-label="Lối vào lớp học">
            {shortcuts.map((shortcut) => <Link key={shortcut.title} className={`harmony-shortcut harmony-shortcut-${shortcut.color}`} href={shortcut.href === "student" ? studentHref : shortcut.href}><span className="harmony-shortcut-icon" aria-hidden="true">{shortcut.icon}</span><span><strong>{shortcut.title}</strong><small>{shortcut.note}</small></span><ArrowIcon /></Link>)}
          </nav>
        </section>

        <div className="harmony-container harmony-class-grid">
          <section className="harmony-stories" id="bang-tin" aria-labelledby="harmony-stories-title">
            <div className="harmony-section-heading"><p className="harmony-eyebrow">NHỮNG ĐIỀU NHỎ, NIỀM VUI TO</p><h2 id="harmony-stories-title">Chuyện lớp mình <span aria-hidden="true">✦</span></h2><p>Hoạt động, điều hay và những khoảnh khắc cùng lớn lên.</p></div>
            <nav className="harmony-tabs" aria-label="Chủ đề bản tin"><Link href="/#bang-tin" aria-current={!selected ? "page" : undefined}>Tất cả</Link>{postCategories.map((category) => <Link key={category} href={`/?muc=${category}#bang-tin`} aria-current={selected === category ? "page" : undefined}>{categoryLabels[category]}</Link>)}</nav>
            {unavailable ? <div className="harmony-empty" role="status"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Bạn vẫn có thể dùng mục đăng nhập bên dưới.</p></div> : stories.length ? <div className="harmony-story-grid">{stories.map((post) => <HarmonyStoryCard key={post.id} post={post} />)}</div> : <div className="harmony-empty"><SunIcon /><h3>Câu chuyện mới đang được chuẩn bị</h3><p>Thầy cô sẽ chia sẻ những hoạt động và lời nhắn của lớp tại đây.</p></div>}
          </section>

          <aside className="harmony-week-column">
            <section className="harmony-calendar" id="lich-tuan" aria-labelledby="harmony-calendar-title">
              <div className="harmony-calendar-heading"><div><p className="harmony-eyebrow">CÙNG NHAU SẴN SÀNG</p><h2 id="harmony-calendar-title">Tuần này có gì?</h2></div><span><ClockIcon /></span></div>
              <p className="harmony-week-range">{formatContentDate(bulletin.weekStart, true)} – {formatContentDate(bulletin.weekEnd, true)}</p>
              {bulletin.events.length ? <ol className="harmony-events">{bulletin.events.map((event) => <li key={event.id}><time dateTime={event.event_date}><strong>{event.event_date.slice(8)}</strong><span>Tháng {Number(event.event_date.slice(5, 7))}</span></time><div><h3>{event.title}</h3><p>{event.class_name}{event.starts_at ? ` · ${event.starts_at}` : ""}</p>{event.body && <p className="harmony-event-body">{event.body}</p>}</div></li>)}</ol> : <div className="harmony-calendar-empty"><span aria-hidden="true">🗓️</span><p>{unavailable ? "Chưa tải được lịch tuần." : "Thầy cô đang cập nhật lịch tuần. Mình cùng chờ thông báo nhé!"}</p></div>}
              <p className="harmony-calendar-note">Lịch học và hoạt động được thầy cô cập nhật theo tuần.</p>
            </section>
            <section className="harmony-daily" aria-labelledby="harmony-daily-title"><span className="harmony-daily-icon" aria-hidden="true">🎒</span><div><p className="harmony-eyebrow">MỖI NGÀY MỘT CHÚT TIẾN BỘ</p><h2 id="harmony-daily-title">Việc nhỏ, em làm được!</h2><p>Vào góc của em để xem lời nhắn, đánh dấu việc đã làm và chuẩn bị cho ngày mai.</p><Link className="harmony-button harmony-button-yellow" href={studentHref}>Xem việc hôm nay <ArrowIcon /></Link></div></section>
          </aside>
        </div>

        <section className="harmony-community" aria-label="Cùng vun đắp một lớp học hạnh phúc">
          <div className="harmony-container harmony-community-grid">
            <section className="harmony-kindness" id="dieu-hay" aria-labelledby="harmony-kindness-title"><div className="harmony-kindness-mark"><HeartIcon /><span aria-hidden="true">✦</span></div><p className="harmony-eyebrow">MỖI TUẦN MỘT ĐIỀU TỐT</p><h2 id="harmony-kindness-title">{kindness?.title ?? "Một lời tử tế, một ngày vui."}</h2><p>{kindness?.body.split("\n").find(Boolean) ?? "Mình cùng lắng nghe, nói lời cảm ơn và dành cho nhau một chút quan tâm mỗi ngày."}</p>{kindness && <Link className="harmony-text-link" href={`/ban-tin/${kindness.id}`}>Mình cùng thực hành <ArrowIcon /></Link>}</section>
            <section className="harmony-parents" id="dong-hanh" aria-labelledby="harmony-parents-title"><div className="harmony-section-heading"><p className="harmony-eyebrow">YÊU THƯƠNG LÀ CÙNG NHAU LỚN LÊN</p><h2 id="harmony-parents-title">Ba mẹ đồng hành <span aria-hidden="true">🌱</span></h2><p>Những gợi ý nhỏ để hiểu con và kết nối mỗi ngày.</p></div>{parentPosts.length ? <div className="harmony-parent-stories">{parentPosts.map((post) => <HarmonyStoryCard post={post} key={post.id} compact />)}</div> : <div className="harmony-parent-empty"><PeopleIcon /><p>Những chia sẻ dành cho phụ huynh sẽ được thầy cô cập nhật tại đây.</p></div>}</section>
          </div>
        </section>

        <section className="harmony-container harmony-access" id="bat-dau" aria-labelledby="harmony-access-title">
          <div className="harmony-access-copy"><span className="harmony-access-book" aria-hidden="true">📖</span><p className="harmony-eyebrow">THẦY CÔ KẾT NỐI · LỚP MÌNH LỚN LÊN</p><h2 id="harmony-access-title">Cùng viết tiếp<br /><span>những ngày hạnh phúc.</span></h2><p>Cập nhật chuyện lớp, lịch tuần và những việc cần chuẩn bị để gia đình và nhà trường cùng đồng hành.</p><p className="harmony-privacy-note"><ShieldIcon />Nội dung riêng của lớp dành cho các tài khoản đã được liên kết.</p></div>
          <div className="harmony-account-card">
            {typeof query.error === "string" && <p className="form-message is-error" role="alert">Chưa thể đăng nhập bằng tài khoản này. Vui lòng thử lại hoặc liên hệ quản trị viên.</p>}
            {query.access === "denied" && <p className="form-message is-error" role="alert">Tài khoản của bạn chưa có quyền truy cập trang quản trị.</p>}
            {studentSignedIn ? <><div className="harmony-account-icon"><SunIcon /></div><h3>Chào nhà khám phá nhỏ!</h3><p>Lời nhắn của thầy cô và những việc nhỏ mỗi ngày đang chờ em.</p><Link className="harmony-button harmony-button-teal" href="/hoc-sinh">Vào góc của em <ArrowIcon /></Link></> : user ? <><div className="harmony-account-avatar">{user.name.slice(0, 1).toLocaleUpperCase("vi")}</div><h3>Xin chào, {user.name}!</h3><p className="harmony-account-email">{user.email}</p>{user.role === "SUPER_ADMIN" || user.role === "TEACHER" ? <><span className="harmony-role-badge">{user.role === "SUPER_ADMIN" ? "Quản trị viên" : "Giáo viên"}</span><p>Cùng viết tiếp những câu chuyện của lớp thầy cô phụ trách.</p><Link className="harmony-button harmony-button-teal" href="/teacher">Cập nhật bản tin lớp <ArrowIcon /></Link>{user.role === "SUPER_ADMIN" && <Link className="harmony-text-link harmony-admin-link" href="/admin">Quản trị trường học <ArrowIcon /></Link>}</> : <><span className="harmony-role-badge is-pending">Đang chờ xét duyệt</span><p>Liên hệ quản trị viên để được xét duyệt quyền và phân công lớp.</p></>}</> : <><div className="harmony-account-icon"><PeopleIcon /></div><h3>Chào mừng thầy cô</h3><p>Đăng nhập Google để cập nhật những câu chuyện của lớp mình.</p>{!setupReady && <span className="harmony-setup-note">Đăng nhập đang được thiết lập</span>}<GoogleSignInButton enabled={setupReady} /><small>Quyền quản lý được xét duyệt riêng cho từng tài khoản.</small><div className="harmony-student-access">Em là học sinh? <Link href="/hoc-sinh/dang-nhap">Đăng nhập tại đây <ArrowIcon /></Link></div></>}
          </div>
        </section>
      </main>

      <footer className="harmony-footer"><div className="harmony-container harmony-footer-inner"><div><Brand /><p>Gieo yêu thương. Nuôi hạnh phúc.<br />Mỗi ngày một hành trình khám phá.</p></div><nav aria-label="Liên kết cuối trang"><a href="#bang-tin">Tin lớp mình</a><a href="#lich-tuan">Lịch tuần</a><Link href={studentHref}>Góc học sinh</Link><a href="#bat-dau">Dành cho thầy cô</a></nav><div className="harmony-footer-school"><SchoolIcon /><strong>Bốn 12</strong><span>Trường Tiểu học Bến Tre</span><a href="#noi-dung">Lên đầu trang ↑</a></div></div></footer>
    </div>
  );
}
