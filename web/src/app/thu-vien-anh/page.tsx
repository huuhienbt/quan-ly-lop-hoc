import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { AlbumGrid } from "@/components/gallery-grid";
import { getGalleryAlbums, type GalleryIdentity } from "@/lib/class-gallery";
import { getCurrentUser } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";
import { getSetupState } from "@/lib/config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thư viện ảnh của lớp" };

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [staff, student, query] = await Promise.all([getCurrentUser(), getCurrentStudentAccount(), searchParams]);
  if (student?.must_change_password) redirect("/hoc-sinh/doi-mat-khau");
  const classId = typeof query.class === "string" ? query.class : undefined;
  const identity: GalleryIdentity = { staffId: staff?.id, studentAccountId: student?.id, studentSessionVersion: student?.session_version };
  let albums: Awaited<ReturnType<typeof getGalleryAlbums>> = [];
  let unavailable = !getSetupState().databaseReady;
  if (!unavailable) {
    try { albums = await getGalleryAlbums(identity, classId); } catch { unavailable = true; }
  }
  const canManage = staff?.role === "TEACHER" || staff?.role === "SUPER_ADMIN";
  return <div className="gallery-shell">
    <header className="gallery-header page-width"><Brand /><Link href="/" className="button button-outline button-small">Trang chủ</Link></header>
    <main id="noi-dung" className="gallery-main page-width">
      <div className="gallery-section-heading"><div><p className="eyebrow">KỶ NIỆM CỦA LỚP MÌNH</p><h1>Thư viện ảnh của lớp</h1><p>Mở từng album để xem những khoảnh khắc đáng nhớ.</p></div><div className="gallery-heading-actions">{canManage && <Link className="button button-primary button-small" href={classId ? `/teacher?class=${encodeURIComponent(classId)}#thu-vien-anh` : "/teacher#thu-vien-anh"}>Quản lý ảnh</Link>}{student && <Link className="button button-outline button-small" href="/hoc-sinh">Về lớp học</Link>}{!staff && !student && <Link className="button button-primary button-small" href="/dang-nhap">Đăng nhập</Link>}</div></div>
      {!staff && !student && <p className="gallery-access-note">Bạn đang xem album công khai. Đăng nhập để xem album dành riêng cho lớp.</p>}
      <AlbumGrid albums={albums} emptyMessage={unavailable ? "Chưa tải được thư viện ảnh. Vui lòng thử lại sau." : "Chưa có album để hiển thị. Khi thầy đăng ảnh, các em sẽ xem được tại đây."} />
      {albums.length === 100 && <p className="gallery-access-note">Đang hiển thị 100 album mới nhất.</p>}
    </main>
  </div>;
}
