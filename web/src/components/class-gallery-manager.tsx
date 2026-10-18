"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import {
  archiveGalleryAlbumAction, removeGalleryPhotoAction, saveAlbumAction, uploadGalleryPhotoAction,
  type GalleryActionState,
} from "@/app/teacher/gallery-actions";
import type { GalleryAlbum, GalleryPhoto } from "@/lib/gallery-schemas";

const emptyState: GalleryActionState = { success: false, message: "" };
const maxOriginalBytes = 20 * 1024 * 1024;
const maxPreparedBytes = 700 * 1024;
const maxBatch = 10;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function Feedback({ state }: { state: GalleryActionState }) {
  return state.message ? <p className={`gallery-feedback ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}

function FieldError({ state, name, prefix }: { state: GalleryActionState; name: string; prefix: string }) {
  return state.fieldErrors?.[name]?.length ? <p className="gallery-field-error" id={`${prefix}-${name}-error`}>{state.fieldErrors[name].join(" ")}</p> : null;
}

function errorProps(state: GalleryActionState, name: string, prefix: string) {
  return { "aria-invalid": Boolean(state.fieldErrors?.[name]?.length), "aria-describedby": state.fieldErrors?.[name]?.length ? `${prefix}-${name}-error` : undefined };
}

function AlbumEditor({ classId, album, onCreated }: { classId: string; album?: GalleryAlbum; onCreated?: (id: string) => void }) {
  const prefix = useId();
  const router = useRouter();
  const [title, setTitle] = useState(album?.title ?? "");
  const [description, setDescription] = useState(album?.description ?? "");
  const [eventDate, setEventDate] = useState(album?.event_date ?? "");
  const [visibility, setVisibility] = useState<string>(album?.visibility ?? "PRIVATE");
  const [state, action, pending] = useActionState(async (previous: GalleryActionState, formData: FormData) => {
    let result: GalleryActionState;
    try { result = await saveAlbumAction(previous, formData); }
    catch { return { success: false, message: "Chưa lưu được album. Nội dung đã nhập vẫn được giữ; vui lòng thử lại." }; }
    if (result.success) {
      if (!album) {
        setTitle(""); setDescription(""); setEventDate(""); setVisibility("PRIVATE");
        if (result.album_id) onCreated?.(result.album_id);
      }
      router.refresh();
    }
    return result;
  }, emptyState);

  return <form className="gallery-editor" action={action} aria-busy={pending} data-gallery-form={album ? "edit-album" : "create-album"}>
    <input type="hidden" name="class_id" value={classId} />
    {album && <input type="hidden" name="id" value={album.id} />}
    <fieldset disabled={pending}>
      <legend className="sr-only">{album ? "Chỉnh sửa album" : "Tạo album mới"}</legend>
      <div className="gallery-field"><label htmlFor={`${prefix}-title`}>Tên album</label><input id={`${prefix}-title`} name="title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Một ngày học thật vui" {...errorProps(state, "title", prefix)} /><FieldError state={state} name="title" prefix={prefix} /></div>
      <div className="gallery-field"><label htmlFor={`${prefix}-description`}>Lời giới thiệu <span>(không bắt buộc)</span></label><textarea id={`${prefix}-description`} name="description" rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} {...errorProps(state, "description", prefix)} /><FieldError state={state} name="description" prefix={prefix} /></div>
      <div className="gallery-form-row">
        <div className="gallery-field"><label htmlFor={`${prefix}-date`}>Ngày hoạt động</label><input id={`${prefix}-date`} name="event_date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} {...errorProps(state, "event_date", prefix)} /><FieldError state={state} name="event_date" prefix={prefix} /></div>
        <div className="gallery-field"><label htmlFor={`${prefix}-visibility`}>Ai được xem?</label><select id={`${prefix}-visibility`} name="visibility" value={visibility} onChange={(event) => setVisibility(event.target.value)} {...errorProps(state, "visibility", prefix)}><option value="PRIVATE">Chỉ trong lớp</option><option value="PUBLIC">Công khai trên trang chủ</option></select><FieldError state={state} name="visibility" prefix={prefix} /></div>
      </div>
      <p className={`gallery-sharing-note ${visibility === "PUBLIC" ? "is-public" : ""}`}>{visibility === "PUBLIC" ? "Mọi người đều xem được ảnh trong album này. Chỉ đăng công khai ảnh học sinh khi đã được đồng ý chia sẻ." : "Ảnh chỉ dành cho học sinh đăng nhập đúng lớp và người quản lý lớp."}</p>
      <Feedback state={state} />
      <button type="submit" className="button button-primary gallery-submit">{pending ? "Đang lưu album…" : album ? "Lưu thay đổi album" : "Tạo album"}</button>
    </fieldset>
  </form>;
}

function ArchiveAlbum({ classId, album }: { classId: string; album: GalleryAlbum }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(async (previous: GalleryActionState, formData: FormData) => {
    try {
      const result = await archiveGalleryAlbumAction(previous, formData);
      if (result.success) router.refresh();
      return result;
    } catch { return { success: false, message: "Chưa lưu trữ được album. Vui lòng thử lại." }; }
  }, emptyState);
  return <details className="gallery-confirm"><summary>Lưu trữ album</summary><form action={action} aria-busy={pending}>
    <input type="hidden" name="class_id" value={classId} /><input type="hidden" name="id" value={album.id} />
    <p>Album và ảnh sẽ ngừng hiển thị. Dữ liệu vẫn được giữ lại.</p>
    <label className="gallery-checkbox"><input type="checkbox" name="confirmed" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} /><span>Tôi xác nhận lưu trữ “{album.title}”.</span></label>
    <Feedback state={state} /><button type="submit" className="button button-danger button-small" disabled={pending || !confirmed}>{pending ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}</button>
  </form></details>;
}

export function GalleryPhotoRemoval({ classId, albumId, photoId, caption }: { classId: string; albumId: string; photoId: string; caption?: string }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(async (previous: GalleryActionState, formData: FormData) => {
    try {
      const result = await removeGalleryPhotoAction(previous, formData);
      if (result.success) router.refresh();
      return result;
    } catch { return { success: false, message: "Chưa ẩn được ảnh. Vui lòng thử lại." }; }
  }, emptyState);
  return <details className="gallery-confirm gallery-photo-removal"><summary>Ẩn ảnh</summary><form action={action} aria-busy={pending}>
    <input type="hidden" name="class_id" value={classId} /><input type="hidden" name="album_id" value={albumId} /><input type="hidden" name="id" value={photoId} />
    <label className="gallery-checkbox"><input name="confirmed" type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} /><span>Xác nhận ẩn {caption ? `ảnh “${caption}”` : "ảnh này"} khỏi thư viện.</span></label>
    <Feedback state={state} /><button type="submit" className="button button-danger button-small" disabled={pending || !confirmed}>{pending ? "Đang ẩn ảnh…" : "Xác nhận ẩn ảnh"}</button>
  </form></details>;
}

async function jpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không tối ưu được ảnh này.")), "image/jpeg", quality));
}

/** Re-encode on the device so each upload fits the Server Action limit and drops original metadata. */
async function prepareGalleryImage(file: File): Promise<File> {
  if (!supportedTypes.has(file.type.toLowerCase())) throw new Error("Chọn ảnh JPG, PNG hoặc WebP; đổi ảnh HEIC sang JPG trước khi chọn.");
  if (file.size > maxOriginalBytes) throw new Error("Ảnh lớn hơn 20 MB. Vui lòng chọn ảnh nhỏ hơn.");
  if (!file.size) throw new Error("Tệp ảnh trống. Vui lòng chọn ảnh khác.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("Không đọc được ảnh. Vui lòng chọn tệp JPG, PNG hoặc WebP khác."); }
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Trình duyệt chưa xử lý được ảnh. Vui lòng cập nhật trình duyệt và thử lại.");
    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
        const blob = await jpegBlob(canvas, quality);
        if (blob.size <= maxPreparedBytes) return new File([blob], "anh-lop-hoc.jpg", { type: "image/jpeg", lastModified: Date.now() });
      }
      scale *= 0.75;
    }
    throw new Error("Chưa tối ưu được ảnh. Vui lòng chọn ảnh nhỏ hơn.");
  } finally { bitmap.close(); }
}

interface QueuedPhoto {
  id: string; uploadId: string; targetAlbum: string; original: File; prepared?: File; preview: string; caption: string;
  status: "ready" | "preparing" | "uploading" | "saved" | "error"; message: string;
}

function PhotoUploader({ classId, albums, albumId, onAlbumChange }: { classId: string; albums: GalleryAlbum[]; albumId: string; onAlbumChange: (id: string) => void }) {
  const prefix = useId();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Map<string, string>());
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [selectionError, setSelectionError] = useState("");
  useEffect(() => {
    const urls = previewUrls.current;
    return () => { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear(); };
  }, []);

  function updatePhoto(id: string, update: Partial<QueuedPhoto>) {
    setQueue((previous) => previous.map((photo) => photo.id === id ? { ...photo, ...update } : photo));
  }
  function dropPhoto(id: string) {
    const url = previewUrls.current.get(id);
    if (url) { URL.revokeObjectURL(url); previewUrls.current.delete(id); }
    setQueue((previous) => previous.filter((photo) => photo.id !== id));
  }
  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const available = maxBatch - queue.length;
    const errors: string[] = [];
    const selected: QueuedPhoto[] = [];
    if (files.length > available) errors.push(`Mỗi lượt giữ tối đa ${maxBatch} ảnh. Bỏ ảnh đã lưu hoặc đã chọn để thêm ảnh khác.`);
    for (const file of files.slice(0, Math.max(0, available))) {
      if (!supportedTypes.has(file.type.toLowerCase())) { errors.push(`${file.name}: chỉ nhận JPG, PNG hoặc WebP.`); continue; }
      if (!file.size || file.size > maxOriginalBytes) { errors.push(`${file.name}: ảnh cần có dung lượng từ 1 byte đến 20 MB.`); continue; }
      const id = crypto.randomUUID(); const preview = URL.createObjectURL(file);
      previewUrls.current.set(id, preview);
      selected.push({ id, uploadId: id, targetAlbum: albumId, original: file, preview, caption: "", status: "ready", message: "" });
    }
    setQueue((previous) => [...previous, ...selected]);
    setSelectionError(errors.join(" "));
  }
  function changeAlbum(id: string) {
    onAlbumChange(id);
    // A changed destination gets a fresh idempotency key; saved photos stay in their original album.
    setQueue((previous) => previous.filter((photo) => photo.status !== "saved").map((photo) => ({ ...photo, uploadId: crypto.randomUUID(), targetAlbum: id, status: "ready", message: "" })));
    for (const photo of queue.filter((item) => item.status === "saved")) {
      URL.revokeObjectURL(photo.preview); previewUrls.current.delete(photo.id);
    }
  }
  function changeCaption(photo: QueuedPhoto, caption: string) {
    updatePhoto(photo.id, { uploadId: crypto.randomUUID(), caption, status: "ready", message: "" });
  }

  const [state, action, pending] = useActionState(async (_previous: GalleryActionState, formData: FormData) => {
    const targetAlbum = String(formData.get("album_id") ?? "");
    if (!albums.some((album) => album.id === targetAlbum)) return { success: false, message: "Vui lòng chọn album đã tạo trước khi thêm ảnh." };
    const remaining = queue.filter((photo) => photo.status !== "saved");
    if (!remaining.length) return { success: false, message: "Vui lòng chọn ảnh từ thiết bị." };
    let completed = 0;
    for (const photo of remaining) {
      let preparing = true;
      try {
        const uploadId = photo.targetAlbum === targetAlbum ? photo.uploadId : crypto.randomUUID();
        updatePhoto(photo.id, { uploadId, targetAlbum, status: "preparing", message: "Đang tối ưu ảnh…" });
        const prepared = photo.prepared ?? await prepareGalleryImage(photo.original);
        preparing = false;
        updatePhoto(photo.id, { prepared, status: "uploading", message: "Đang tải ảnh lên…" });
        const data = new FormData();
        data.set("class_id", classId); data.set("album_id", targetAlbum); data.set("caption", photo.caption);
        data.set("client_upload_id", uploadId); data.set("image", prepared);
        const result = await uploadGalleryPhotoAction(emptyState, data);
        if (!result.success) { updatePhoto(photo.id, { status: "error", message: result.message }); continue; }
        completed += 1;
        updatePhoto(photo.id, { status: "saved", message: "Đã lưu vào album." });
      } catch (cause) {
        updatePhoto(photo.id, { status: "error", message: preparing && cause instanceof Error ? cause.message : "Chưa nhận được xác nhận lưu ảnh. Bấm tải lại để kiểm tra và thử tiếp." });
      }
    }
    router.refresh();
    const failures = remaining.length - completed;
    return { success: failures === 0, message: failures ? `Đã lưu ${completed}/${remaining.length} ảnh. Các ảnh chưa lưu vẫn ở đây; bấm tải lại để thử tiếp.` : `Đã lưu ${completed} ảnh vào album.` };
  }, emptyState);

  const unfinished = queue.filter((photo) => photo.status !== "saved").length;
  return <form className="gallery-upload-form" action={action} aria-busy={pending} data-gallery-form="upload-photos">
    <fieldset disabled={pending}>
      <legend className="sr-only">Thêm ảnh từ thiết bị</legend>
      <div className="gallery-field"><label htmlFor={`${prefix}-album`}>Album nhận ảnh</label><select id={`${prefix}-album`} name="album_id" required value={albumId} onChange={(event) => changeAlbum(event.target.value)}><option value="">Chọn album…</option>{albumId && !albums.some((album) => album.id === albumId) && <option value={albumId}>Album vừa tạo — đang cập nhật…</option>}{albums.map((album) => <option value={album.id} key={album.id}>{album.title} · {album.visibility === "PRIVATE" ? "Trong lớp" : "Công khai"}</option>)}</select></div>
      <input type="file" className="sr-only" ref={fileInput} id={`${prefix}-files`} accept="image/jpeg,image/png,image/webp" multiple onChange={chooseFiles} tabIndex={-1} aria-label="Chọn ảnh từ thiết bị để thêm vào album" />
      <div className="gallery-upload-actions"><button type="button" className="button button-outline" onClick={() => fileInput.current?.click()} aria-controls={`${prefix}-files`} disabled={!albums.length || queue.length >= maxBatch}>Chọn ảnh từ thiết bị</button>{queue.some((photo) => photo.status === "saved") && <button type="button" className="button button-quiet" onClick={() => queue.filter((photo) => photo.status === "saved").forEach((photo) => dropPhoto(photo.id))}>Bỏ ảnh đã lưu khỏi danh sách chọn</button>}</div>
      <p className="gallery-help">JPG, PNG hoặc WebP, tối đa 20 MB/ảnh và 10 ảnh mỗi lượt. Ảnh được tối ưu trước khi tải lên.</p>
      {!albums.length && <p className="gallery-help">Tạo một album ở bên trên để bắt đầu thêm ảnh.</p>}
      {selectionError && <p role="alert" className="gallery-field-error">{selectionError}</p>}
      {queue.length > 0 && <ol className="gallery-upload-queue">{queue.map((photo, index) => <li key={photo.id} className={`gallery-upload-item is-${photo.status}`}>
        <Image src={photo.preview} alt={`Xem trước ảnh đã chọn ${index + 1}`} width={100} height={80} unoptimized />
        <div className="gallery-upload-copy"><p className="gallery-file-name">{photo.original.name}</p><label htmlFor={`${prefix}-${photo.id}-caption`}>Chú thích ảnh {index + 1}</label><input id={`${prefix}-${photo.id}-caption`} maxLength={500} value={photo.caption} onChange={(event) => changeCaption(photo, event.target.value)} disabled={photo.status === "saved"} placeholder="Một kỷ niệm của lớp…" /><p className="gallery-upload-status" role="status">{photo.message || "Sẵn sàng tải lên."}</p></div>
        <button type="button" className="button button-quiet button-small gallery-remove-choice" onClick={() => dropPhoto(photo.id)} aria-label={`Bỏ ảnh ${photo.original.name} khỏi danh sách chọn`}>Bỏ chọn</button>
      </li>)}</ol>}
      <Feedback state={state} />
      <button type="submit" className="button button-primary gallery-submit" disabled={!unfinished || !albumId || !albums.some((album) => album.id === albumId)}>{pending ? "Đang lưu từng ảnh…" : queue.some((photo) => photo.status === "error") ? `Tải lại ${unfinished} ảnh chưa lưu` : `Tải ${unfinished || "các"} ảnh lên album`}</button>
    </fieldset>
  </form>;
}

export function ClassGalleryManager({ classId, albums, photos }: { classId: string; albums: GalleryAlbum[]; photos: GalleryPhoto[] }) {
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? "");
  const currentAlbumId = albums.some((album) => album.id === albumId) ? albumId : albums[0]?.id ?? "";
  const selectedAlbum = albums.find((album) => album.id === currentAlbumId);
  const selectedPhotos = selectedAlbum ? photos.filter((photo) => photo.album_id === selectedAlbum.id) : [];
  return <div className="gallery-manager">
    <div className="gallery-manager-top"><section className="gallery-panel"><div className="gallery-panel-heading"><h3>Tạo album mới</h3><p>Gom những kỷ niệm theo hoạt động của lớp.</p></div><div className="gallery-panel-body"><AlbumEditor classId={classId} onCreated={setAlbumId} /></div></section>
      <section className="gallery-panel"><div className="gallery-panel-heading"><h3>Thêm ảnh vào album</h3><p>Chọn một hoặc nhiều ảnh từ điện thoại, máy tính.</p></div><div className="gallery-panel-body"><PhotoUploader classId={classId} albums={albums} albumId={currentAlbumId} onAlbumChange={setAlbumId} /></div></section></div>
    {selectedAlbum && <section className="gallery-panel gallery-selected-album"><div className="gallery-panel-heading"><div className="gallery-album-heading"><h3>{selectedAlbum.title}</h3><span className={`gallery-visibility gallery-visibility-${selectedAlbum.visibility.toLowerCase()}`}>{selectedAlbum.visibility === "PRIVATE" ? "Chỉ trong lớp" : "Công khai"}</span></div><p>{selectedAlbum.photo_count} ảnh · <Link href={`/thu-vien-anh/${selectedAlbum.id}`} className="gallery-text-link">Mở toàn bộ album →</Link></p></div><div className="gallery-panel-body">
      <details className="gallery-edit-details"><summary>Chỉnh sửa tên, ngày và quyền xem album</summary><AlbumEditor key={`${selectedAlbum.id}-${selectedAlbum.updated_at}`} classId={classId} album={selectedAlbum} /></details>
      {selectedPhotos.length ? <div className="gallery-managed-photos">{selectedPhotos.map((photo) => <article key={photo.id} className="gallery-managed-photo"><a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={photo.caption || "Mở ảnh trong tab mới"}><Image src={photo.url} alt={photo.caption || "Kỷ niệm của lớp"} width={photo.width} height={photo.height} unoptimized /></a>{photo.caption && <p>{photo.caption}</p>}<GalleryPhotoRemoval classId={classId} albumId={selectedAlbum.id} photoId={photo.id} caption={photo.caption} /></article>)}</div> : <p className="gallery-empty">{selectedAlbum.photo_count ? "Mở toàn bộ album để xem các ảnh đã lưu trước đó." : "Album đang chờ những tấm ảnh đầu tiên."}</p>}
      {selectedAlbum.photo_count > selectedPhotos.length && <p className="gallery-help">Đang hiển thị các ảnh vừa thêm. <Link className="gallery-text-link" href={`/thu-vien-anh/${selectedAlbum.id}`}>Mở toàn bộ album để xem và quản lý các ảnh còn lại.</Link></p>}
      <ArchiveAlbum key={selectedAlbum.id} classId={classId} album={selectedAlbum} />
    </div></section>}
  </div>;
}
