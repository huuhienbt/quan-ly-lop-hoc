import Image from "next/image";
import Link from "next/link";
import type { GalleryAlbum, GalleryPhoto } from "@/lib/gallery-schemas";
import { GalleryPhotoRemoval } from "@/components/class-gallery-manager";

function galleryImageUrl(value: string | null) {
  return value && /^\/api\/gallery-images\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function albumDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export function AlbumGrid({ albums, emptyMessage = "Chưa có album ảnh. Những kỷ niệm của lớp sẽ xuất hiện tại đây." }: {
  albums: GalleryAlbum[];
  emptyMessage?: string;
}) {
  if (!albums.length) return <p className="gallery-empty">{emptyMessage}</p>;

  return <ul className="gallery-album-grid">
    {albums.map((album) => {
      const coverUrl = galleryImageUrl(album.cover_url);
      return <li key={album.id} className="gallery-album-card">
        <Link className="gallery-album-link" href={`/thu-vien-anh/${encodeURIComponent(album.id)}`}>
          <div className="gallery-album-cover">
            {coverUrl ? <Image src={coverUrl} alt="" fill unoptimized sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" />
              : <span className="gallery-album-placeholder"><span aria-hidden="true">📷</span>Chưa có ảnh</span>}
          </div>
          <div className="gallery-album-body">
            <div className="gallery-album-meta">
              <span className={`gallery-visibility gallery-visibility-${album.visibility.toLowerCase()}`}>{album.visibility === "PUBLIC" ? "Công khai" : "Trong lớp"}</span>
              <span>{album.photo_count} ảnh</span>
            </div>
            <h3>{album.title}</h3>
            <p className="gallery-album-class">{album.class_name}</p>
            {album.event_date && <time dateTime={album.event_date}>{albumDate(album.event_date)}</time>}
            {album.description && <p className="gallery-album-description">{album.description}</p>}
            <span className="gallery-album-open">Xem album <span aria-hidden="true">→</span></span>
          </div>
        </Link>
      </li>;
    })}
  </ul>;
}

export function PhotoGrid({ photos, manage = false }: { photos: GalleryPhoto[]; manage?: boolean }) {
  if (!photos.length) return <p className="gallery-empty">Album chưa có ảnh. Ảnh do giáo viên thêm sẽ hiển thị ở đây.</p>;

  return <div className="gallery-photo-grid">
    {photos.map((photo, index) => {
      const imageUrl = galleryImageUrl(photo.url);
      const label = photo.caption || `Ảnh ${index + 1}`;
      return <figure key={photo.id} className="gallery-photo-card">
        {imageUrl ? <a className="gallery-photo-link" href={imageUrl} target="_blank" rel="noopener noreferrer" aria-label={`${label} — mở ảnh trong thẻ mới`}>
          <Image src={imageUrl} alt={label} width={photo.width} height={photo.height} unoptimized sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" />
        </a> : <div className="gallery-photo-unavailable">Không tải được ảnh này.</div>}
        <figcaption>{label}</figcaption>
        {manage && <GalleryPhotoRemoval classId={photo.class_id} albumId={photo.album_id} photoId={photo.id} caption={photo.caption} />}
      </figure>;
    })}
  </div>;
}
