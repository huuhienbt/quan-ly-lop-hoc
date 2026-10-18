import Link from "next/link";
import { AlbumGrid } from "@/components/gallery-grid";
import { getPublicGalleryAlbums } from "@/lib/class-gallery";
import { getSetupState } from "@/lib/config";

export async function HomeGalleryPreview() {
  let albums: Awaited<ReturnType<typeof getPublicGalleryAlbums>> = [];
  let unavailable = !getSetupState().databaseReady;
  if (!unavailable) {
    try { albums = await getPublicGalleryAlbums(4); } catch { unavailable = true; }
  }
  return <section id="thu-vien-anh" className="home-gallery page-width" aria-labelledby="home-gallery-title">
    <div className="gallery-section-heading"><div><p className="eyebrow">LƯU GIỮ NIỀM VUI</p><h2 id="home-gallery-title">Thư viện ảnh của lớp</h2><p>Những khoảnh khắc cùng học, cùng chơi và lớn lên.</p></div><Link href="/thu-vien-anh" className="button button-outline button-small">Mở thư viện ảnh <span aria-hidden="true">→</span></Link></div>
    <AlbumGrid albums={albums} emptyMessage={unavailable ? "Thư viện ảnh tạm thời chưa tải được. Vui lòng thử lại sau." : "Những album công khai sẽ xuất hiện tại đây khi thầy đăng ảnh. Đăng nhập để xem cả album dành riêng cho lớp."} />
  </section>;
}
