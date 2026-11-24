import { LessonContent } from "@/components/lesson-render";
import { decodeLesson } from "@/lib/lessons";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { HomeFooter } from "@/components/home-footer";
import { PostArtwork, categoryLabels, formatContentDate } from "@/components/bulletin";
import { ArrowIcon } from "@/components/icons";
import { getPublicPost, getStudentNewsPost } from "@/lib/class-content";
import { getCurrentStudentAccount } from "@/lib/student-session";
import "../../bulletin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bản tin lớp học" };

export default async function PublicPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) notFound();
  let post = await getPublicPost(id);
  if (!post) {
    const student = await getCurrentStudentAccount();
    if (student && !student.must_change_password) post = await getStudentNewsPost(student.id, student.session_version, id);
  }
  if (!post) notFound();
  const blocks = decodeLesson(post.bulletin_content);
  return <div className="site-shell bulletin-article-shell"><header className="site-header page-width" id="dau-trang-ban-tin"><Brand /><Link className="button button-outline" href="/dang-nhap">Góc học sinh <ArrowIcon /></Link></header><main id="noi-dung" className="bulletin-article-main"><Link href="/#bang-tin" className="bulletin-back-link">← Về bảng tin lớp mình</Link><article><div className="bulletin-article-meta"><span className={`bulletin-tag tag-${post.category.toLowerCase()}`}>{categoryLabels[post.category]}</span><span>{post.class_name}</span>{post.published_at && <time dateTime={post.published_at}>{formatContentDate(post.published_at)}</time>}</div><h1>{post.title}</h1><div className="bulletin-article-cover">{post.cover_url ? <Image src={post.cover_url} alt={post.title} width={1000} height={560} unoptimized /> : <PostArtwork category={post.category} />}</div><div className="bulletin-article-body">{blocks ? <LessonContent blocks={blocks} /> : post.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></article><div className="bulletin-article-end"><span>Gieo yêu thương · Nuôi hạnh phúc</span><Link href="/#bang-tin">Đọc thêm bản tin <ArrowIcon /></Link></div></main><HomeFooter topHref="#dau-trang-ban-tin" /></div>;
}
