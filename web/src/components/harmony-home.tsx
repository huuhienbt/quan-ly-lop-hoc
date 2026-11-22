import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { HomeAccountLink } from "@/components/home-account-link";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { HomeFooter } from "@/components/home-footer";
import type { HomePageProps } from "@/components/home-page-props";
import { categoryLabels, formatContentDate } from "@/components/bulletin";
import { ArrowIcon, ClockIcon, HeartIcon, SunIcon } from "@/components/icons";
import type { ContentPost } from "@/lib/content-schemas";

function HarmonyStoryCard({ post, compact = false }: { post: ContentPost; compact?: boolean }) {
  return (
    <article className={`harmony-story-card home-news-item${compact ? " is-compact" : ""}`}>
      <Link className="harmony-story-cover home-news-cover" href={`/ban-tin/${post.id}`} tabIndex={-1} aria-hidden="true">
        {post.cover_url ? (
          <Image src={post.cover_url} alt="" fill sizes="(max-width: 520px) 60vw, (max-width: 760px) 312px, (max-width: 890px) 40vw, 324px" unoptimized />
        ) : <span className={`harmony-story-art harmony-art-${post.category.toLowerCase()}`} />}
      </Link>
      <div className="harmony-story-body home-news-body">
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

export function HarmonyHome({ posts, unavailable, accountName, section, studentSignedIn, classroom }: HomePageProps) {
  return (
    <div className="harmony-home">
      <header className="harmony-header">
        <div className="harmony-container harmony-header-inner">
          <Brand />
          <div className="harmony-header-actions"><HomeAccountLink className="harmony-button harmony-button-yellow" accountName={accountName} studentSignedIn={studentSignedIn} /></div>
        </div>
      </header>

      <main id="noi-dung">
        <section className="harmony-hero-wrap" aria-labelledby="harmony-home-title">
          <div className="harmony-container harmony-hero">
            <div className="harmony-hero-copy">
              <p className="harmony-eyebrow"><span /> LỚP BỐN 12 · TRƯỜNG TIỂU HỌC BẾN TRE</p>
              <h1 id="harmony-home-title">Vui học hôm nay.<br /><span>Khám phá ngày mai.</span></h1>
              <Link className="harmony-button harmony-button-yellow harmony-hero-cta" href={studentSignedIn ? "#loi-tat" : "/dang-nhap"}>Vào lớp học <ArrowIcon /></Link>
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

        <div className="harmony-container"><HomeShortcuts activeSection={section} studentSignedIn={studentSignedIn} /></div>
        {classroom ? <div className="harmony-container">{classroom}</div> : <div className="harmony-container harmony-feed-wrap">
          <section className="harmony-stories" id="bang-tin" aria-labelledby="harmony-stories-title">
            <div className="harmony-section-heading"><h2 id="harmony-stories-title">Tin lớp mình <span aria-hidden="true">✦</span></h2></div>

            {unavailable ? <div className="harmony-empty" role="status"><ClockIcon /><h3>Bản tin tạm thời chưa sẵn sàng</h3><p>Em hãy thử lại sau nhé.</p></div> : posts.length ? <div className="harmony-story-grid home-news-list">{posts.map((post) => <HarmonyStoryCard key={post.id} post={post} />)}</div> : <div className="harmony-empty"><SunIcon /><h3>Chưa có tin mới</h3><p>Thầy cô sẽ chia sẻ những hoạt động và lời nhắn của lớp tại đây.</p></div>}
          </section>

        </div>}

      </main>
      <HomeFooter container="harmony-container" />
    </div>
  );
}
