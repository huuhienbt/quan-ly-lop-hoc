import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, HeartIcon, PeopleIcon, SchoolIcon, SunIcon } from "@/components/icons";
import type { ContentPost, PostCategory } from "@/lib/content-schemas";

export const categoryLabels: Record<PostCategory, string> = {
  GENERAL: "Tin lớp học", CLASS_STORY: "Chuyện vui lớp mình", KINDNESS: "Mỗi tuần một điều tốt",
  PARENT_GUIDE: "Cùng con lớn lên", DISCOVERY: "Góc khám phá",
};

export function formatContentDate(value: string, short = false) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value);
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", ...(short ? {} : { year: "numeric" }) }).format(date);
}

export function PostArtwork({ category }: { category: PostCategory }) {
  const Icon = category === "KINDNESS" ? HeartIcon : category === "PARENT_GUIDE" ? PeopleIcon : category === "CLASS_STORY" ? SchoolIcon : SunIcon;
  return <div className={`bulletin-art art-${category.toLowerCase()}`} aria-hidden="true"><span className="bulletin-art-orbit" /><span className="bulletin-art-icon"><Icon /></span><span className="bulletin-art-spark">✦</span><span className="bulletin-art-dot" /></div>;
}

export function PostCard({ post, compact = false }: { post: ContentPost; compact?: boolean }) {
  return <article className={`bulletin-card${compact ? " is-compact" : ""}`}>
    <Link href={`/ban-tin/${post.id}`} className="bulletin-cover-link" tabIndex={-1} aria-hidden="true">
      {post.cover_url ? <Image className="bulletin-cover" src={post.cover_url} alt="" width={720} height={400} unoptimized /> : <PostArtwork category={post.category} />}
    </Link>
    <div className="bulletin-card-body"><div className="bulletin-card-meta"><span className={`bulletin-tag tag-${post.category.toLowerCase()}`}>{categoryLabels[post.category]}</span>{post.published_at && <time dateTime={post.published_at}>{formatContentDate(post.published_at, true)}</time>}</div>
      <h3><Link href={`/ban-tin/${post.id}`}>{post.title}</Link></h3><p className="bulletin-excerpt">{post.body}</p>
      <Link className="bulletin-read-more" href={`/ban-tin/${post.id}`}>Đọc câu chuyện <ArrowIcon /></Link>
    </div>
  </article>;
}
