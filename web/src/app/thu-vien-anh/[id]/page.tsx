import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { PhotoGrid } from "@/components/gallery-grid";
import { getGalleryAlbum } from "@/lib/class-gallery";
import { AuthorizationError, getCurrentUser, requireClassTeacher } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Album ảnh của lớp" };

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query, staff, student] = await Promise.all([params, searchParams, getCurrentUser(), getCurrentStudentAccount()]);
  if (student?.must_change_password) redirect("/hoc-sinh/doi-mat-khau");
  const requestedPage = typeof query.trang === "string" && /^\d{1,6}$/.test(query.trang) ? Number(query.trang) : 1;
  const page = Math.max(1, requestedPage);
  const result = await getGalleryAlbum(id, { staffId: staff?.id, studentAccountId: student?.id, studentSessionVersion: student?.session_version }, (page - 1) * 60);
  if (!result) notFound();
  const { album, photos, hasMore } = result;
  let canManage = false;
  if (staff) {
    try { await requireClassTeacher(album.class_id); canManage = true; }
    catch (error) { if (!(error instanceof AuthorizationError)) throw error; }
  }
  return <div className="gallery-shell">
    <header className="gallery-header page-width"><Brand /><Link className="button button-outline button-small" href="/thu-vien-anh">Thư viện ảnh</Link></header>
    <main id="noi-dung" className="gallery-main page-width">
      <div className="gallery-section-heading"><div><p className="eyebrow">{album.class_name} · {album.school_name}</p><h1>{album.title}</h1>{album.description && <p className="gallery-album-description">{album.description}</p>}<p>{album.photo_count} ảnh{album.event_date && <> · <time dateTime={album.event_date}>{album.event_date.split("-").reverse().join("/")}</time></>} · {album.visibility === "PUBLIC" ? "Công khai" : "Dành riêng cho lớp"}</p></div></div>
      {photos.length > 0 && <PhotoGrid photos={photos} manage={canManage} />}
      {!photos.length && <p className="gallery-empty">{page > 1 ? "Không còn ảnh ở trang này." : "Album đang chờ thầy thêm những bức ảnh đầu tiên."}</p>}
      {(page > 1 || hasMore) && <nav className="gallery-pagination" aria-label="Các trang ảnh">{page > 1 && <Link className="button button-outline button-small" href={`/thu-vien-anh/${encodeURIComponent(id)}?trang=${page - 1}`}>← Trang trước</Link>}<span>Trang {page}</span>{hasMore && <Link className="button button-outline button-small" href={`/thu-vien-anh/${encodeURIComponent(id)}?trang=${page + 1}`}>Trang sau →</Link>}</nav>}
    </main>
  </div>;
}
