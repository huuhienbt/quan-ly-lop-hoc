import Image from "next/image";
import Link from "next/link";
import { ArrowIcon, HeartIcon, PeopleIcon, SchoolIcon, SunIcon } from "@/components/icons";
import type { ContentPost, PostCategory } from "@/lib/content-schemas";
import { lessonKinds } from "@/lib/lessons";

export const categoryLabels: Record<PostCategory, string> = {
  GENERAL: "Tin lớp học", CLASS_STORY: "Chuyện lớp", KINDNESS: "Việc tốt",
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

export interface PostCardProps { post: ContentPost; compact?: boolean; lesson?: boolean }

export function postCardTarget(post: ContentPost, lesson: boolean) {
  return lesson
    ? { href: `/?muc=hoc-tap&bai=${encodeURIComponent(post.id)}#noi-dung-lop`, label: lessonKinds[post.kind] }
    : { href: `/ban-tin/${post.id}`, label: categoryLabels[post.category] };
}

export function PostCard({ post, compact = false, lesson = false }: PostCardProps) {
  const { href, label } = postCardTarget(post, lesson);
  return <article className={`bulletin-card home-news-item card-${post.category.toLowerCase()}${compact ? " is-compact" : ""}`}>
    <Link href={href} className="bulletin-cover-link home-news-cover" prefetch={false} tabIndex={-1} aria-hidden="true">
      {post.cover_url ? <Image className="bulletin-cover" src={post.cover_url} alt="" width={720} height={400} unoptimized /> : <PostArtwork category={post.category} />}
    </Link>
    <div className="bulletin-card-body home-news-body"><div className="bulletin-card-meta"><span className={`bulletin-tag tag-${post.category.toLowerCase()}`}>{label}</span>{post.published_at && <time dateTime={post.published_at}>{formatContentDate(post.published_at, true)}</time>}</div>
      <h3><Link href={href} prefetch={false}>{post.title}</Link></h3><p className="bulletin-excerpt">{post.body}</p>
      <Link className="bulletin-read-more" href={href} prefetch={false}>{lesson ? "Mở bài học" : "Đọc câu chuyện"} <ArrowIcon /></Link>
    </div>
  </article>;
}
