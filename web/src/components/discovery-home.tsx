import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { HomeFooter } from "@/components/home-footer";
import { categoryLabels, formatContentDate } from "@/components/bulletin";
import { ArrowIcon, ClockIcon, StarIcon, SunIcon } from "@/components/icons";
import type { ContentPost } from "@/lib/content-schemas";

interface DiscoveryHomeProps {
  posts: ContentPost[];
  unavailable: boolean;
  signedIn: boolean;
  studentSignedIn: boolean;
}

function DiscoveryCard({ post }: { post: ContentPost }) {
  return <article className={`discovery-story-card home-news-item discovery-story-${post.category.toLowerCase()}`}>
    <Link className="discovery-story-cover home-news-cover" href={`/ban-tin/${post.id}`} tabIndex={-1} aria-hidden="true">
      {post.cover_url ? <Image src={post.cover_url} alt="" fill sizes="(max-width: 520px) 60vw, (max-width: 760px) 312px, (max-width: 890px) 40vw, 324px" unoptimized /> : <span className={`discovery-story-art discovery-art-${post.category.toLowerCase()}`} />}
    </Link>
    <div className="discovery-story-body home-news-body"><div className="discovery-story-meta"><span>{categoryLabels[post.category]}</span>{post.published_at && <time dateTime={post.published_at}>{formatContentDate(post.published_at, true)}</time>}</div><h3><Link href={`/ban-tin/${post.id}`}>{post.title}</Link></h3><p>{post.body}</p><Link className="discovery-text-link" href={`/ban-tin/${post.id}`}>Đọc tiếp <ArrowIcon /></Link></div>
  </article>;
}

export function DiscoveryHome({ posts, unavailable, signedIn, studentSignedIn }: DiscoveryHomeProps) {
  const studentHref = studentSignedIn ? "/hoc-sinh" : "/dang-nhap";

  return <div className="discovery-home">
    <header className="discovery-header"><div className="discovery-container discovery-header-inner"><Brand classHomepage /><div className="discovery-header-actions"><Link className="discovery-button discovery-button-teal" href="/dang-nhap">{signedIn ? "Tài khoản" : "Đăng nhập"}<ArrowIcon /></Link></div></div></header>
    <main id="noi-dung">
      <section className="discovery-hero" aria-labelledby="discovery-home-title"><Image className="discovery-hero-image" src="/images/discovery-hero-3d.webp" alt="" fill sizes="100vw" preload /><div className="discovery-hero-shade" /><div className="discovery-hero-copy"><h1 id="discovery-home-title">CHÀO MỪNG ĐẾN VỚI LỚP BỐN 12</h1><Link className="discovery-button discovery-button-yellow" href={studentHref}>Vào lớp học <ArrowIcon /></Link><span className="discovery-hero-school">Trường Tiểu học Bến Tre</span></div><div className="discovery-hero-bottom" /></section>

      <div className="discovery-container"><HomeShortcuts studentSignedIn={studentSignedIn} /></div>
      <section className="discovery-stories" id="bang-tin" aria-labelledby="discovery-stories-title"><div className="discovery-container"><div className="discovery-section-title"><h2 id="discovery-stories-title"><StarIcon /><span>Tin lớp mình</span><StarIcon /></h2></div>{unavailable ? <div className="discovery-empty" role="status"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Em hãy thử lại sau nhé.</p></div> : posts.length ? <div className="discovery-story-grid home-news-list">{posts.map((post) => <DiscoveryCard key={post.id} post={post} />)}</div> : <div className="discovery-empty"><SunIcon /><h3>Chưa có tin mới</h3><p>Thầy cô sẽ chia sẻ những hoạt động và lời nhắn của lớp tại đây.</p></div>}</div></section>
    </main>
    <HomeFooter container="discovery-container" />
  </div>;
}
