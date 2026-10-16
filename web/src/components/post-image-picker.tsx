"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import "./post-image-picker.css";

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_SAVED_BYTES = 700 * 1024;
const MAX_DIMENSION = 1600;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface PostImagePickerProps {
  prefix: string;
  coverUrl: string;
  onCoverUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onProcessingChange?: (processing: boolean) => void;
  disabled?: boolean;
  error?: string;
  /** Change after a successful save to clear the temporary device selection. */
  resetKey?: string | number;
}

interface DevicePreview { url: string; bytes: number }

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Không thể xử lý ảnh này. Thầy cô vui lòng chọn ảnh khác."));
    }, "image/jpeg", quality);
  });
}

/** A fresh JPEG strips image metadata and keeps the complete form comfortably small. */
async function prepareDeviceImage(file: File, isCurrent: () => boolean): Promise<File | null> {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Vui lòng chọn ảnh JPG, PNG hoặc WebP. Ảnh HEIC cần đổi sang JPG trước khi chọn.");
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error("Ảnh lớn hơn 20 MB. Thầy cô vui lòng chọn ảnh nhỏ hơn.");
  }
  if (file.size === 0) throw new Error("Tệp ảnh trống. Thầy cô vui lòng chọn lại ảnh.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Không đọc được ảnh này. Thầy cô vui lòng chọn ảnh JPG, PNG hoặc WebP khác.");
  }

  try {
    if (!isCurrent()) return null;
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new Error("Không đọc được kích thước ảnh. Thầy cô vui lòng chọn ảnh khác.");
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Trình duyệt chưa xử lý được ảnh. Thầy cô thử cập nhật trình duyệt hoặc dùng liên kết ảnh.");
    let scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    // Usually the first pass suffices; noisy photos get a smaller second pass.
    for (let resize = 0; resize < 4; resize += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42]) {
        if (!isCurrent()) return null;
        const blob = await canvasBlob(canvas, quality);
        if (!isCurrent()) return null;
        if (blob.size <= MAX_SAVED_BYTES) {
          return new File([blob], "anh-bai-viet.jpg", { type: "image/jpeg", lastModified: Date.now() });
        }
      }
      scale *= 0.75;
    }
    throw new Error("Chưa tối ưu được ảnh này. Thầy cô vui lòng chọn ảnh nhỏ hơn.");
  } finally {
    bitmap.close();
  }
}

function isHttpsUrl(value: string): boolean {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function PostImagePicker(props: PostImagePickerProps) {
  return <PostImagePickerFields key={props.resetKey ?? "initial"} {...props} />;
}

function PostImagePickerFields({ prefix, coverUrl, onCoverUrlChange, onFileChange, onProcessingChange, disabled = false, error }: PostImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);
  const previewRef = useRef<string | null>(null);
  const processingCallbackRef = useRef(onProcessingChange);
  const [preview, setPreview] = useState<DevicePreview | null>(null);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState("");
  const [failedSource, setFailedSource] = useState("");

  useEffect(() => { processingCallbackRef.current = onProcessingChange; }, [onProcessingChange]);
  useEffect(() => () => {
    selectionRef.current += 1;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    processingCallbackRef.current?.(false);
  }, []);

  const managedImage = /^\/api\/post-images\/[a-zA-Z0-9_-]+$/.test(coverUrl);
  const previewSource = preview?.url ?? (managedImage || isHttpsUrl(coverUrl) ? coverUrl : "");
  const displayedError = localError || error;
  const description = `${prefix}-image-help${displayedError ? ` ${prefix}-image-error` : ""}`;

  function replacePreview(next: DevicePreview | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next?.url ?? null;
    setPreview(next);
    setFailedSource("");
  }

  function stopProcessing() {
    selectionRef.current += 1;
    setProcessing(false);
    processingCallbackRef.current?.(false);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permit choosing the same file again after removal or an unsuccessful attempt.
    event.target.value = "";
    if (!file || disabled) return;
    const selection = ++selectionRef.current;
    const isCurrent = () => selectionRef.current === selection;
    setLocalError("");
    setProcessing(true);
    processingCallbackRef.current?.(true);
    try {
      const normalized = await prepareDeviceImage(file, isCurrent);
      if (!normalized || !isCurrent()) return;
      replacePreview({ url: URL.createObjectURL(normalized), bytes: normalized.size });
      onFileChange(normalized);
      onCoverUrlChange("");
    } catch (cause) {
      if (isCurrent()) {
        setLocalError(cause instanceof Error ? cause.message : "Không xử lý được ảnh. Thầy cô vui lòng chọn lại.");
      }
    } finally {
      if (isCurrent()) {
        setProcessing(false);
        processingCallbackRef.current?.(false);
      }
    }
  }

  function removeImage() {
    stopProcessing();
    replacePreview(null);
    setLocalError("");
    onFileChange(null);
    onCoverUrlChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function changeLink(value: string) {
    stopProcessing();
    replacePreview(null);
    setLocalError("");
    onFileChange(null);
    onCoverUrlChange(value);
  }

  return <div className="post-image-picker" role="group" aria-labelledby={`${prefix}-image-label`} aria-describedby={description} aria-busy={processing}>
    <p className="post-image-picker__label" id={`${prefix}-image-label`}>Ảnh bìa bài viết <span>(không bắt buộc)</span></p>
    <input type="hidden" name="cover_url" value={coverUrl} />
    <input ref={inputRef} id={`${prefix}-image-file`} className="post-image-picker__file" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={disabled} tabIndex={-1} aria-label="Chọn tệp ảnh từ thiết bị" />
    <div className="post-image-picker__actions">
      <button className="post-image-picker__choose" type="button" onClick={() => inputRef.current?.click()} disabled={disabled} aria-controls={`${prefix}-image-file`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m4 17 5-5 4 4 3-3 5 5" /></svg>
        {preview || coverUrl ? "Chọn ảnh khác từ thiết bị" : "Chọn ảnh từ thiết bị"}
      </button>
      {(preview || coverUrl || processing) && <button className="post-image-picker__remove" type="button" onClick={removeImage} disabled={disabled}>Bỏ ảnh</button>}
    </div>
    <p className="post-image-picker__help" id={`${prefix}-image-help`}>Chọn ảnh JPG, PNG hoặc WebP từ điện thoại, máy tính (tối đa 20 MB). Ảnh được tối ưu trước khi lưu.</p>
    {previewSource && failedSource !== previewSource && <figure className="post-image-picker__preview">
      <Image src={previewSource} alt="Xem trước ảnh bìa bài viết" width={640} height={360} unoptimized referrerPolicy="no-referrer" onError={() => setFailedSource(previewSource)} />
      <figcaption>{preview ? `Ảnh đã chọn · ${Math.max(1, Math.round(preview.bytes / 1024))} KB` : managedImage ? "Ảnh đã lưu trong bài viết" : "Xem trước ảnh từ liên kết"}</figcaption>
    </figure>}
    {previewSource && failedSource === previewSource && <p className="post-image-picker__notice">Chưa xem trước được ảnh. Thầy cô kiểm tra lại liên kết hoặc chọn ảnh từ thiết bị.</p>}
    <div className="post-image-picker__status" role="status" aria-live="polite">
      {processing ? "Đang chuẩn bị ảnh, thầy cô chờ một chút…" : preview ? "Ảnh đã sẵn sàng. Bấm lưu bài viết để lưu ảnh cùng nội dung." : managedImage ? "Bài viết đang dùng ảnh đã tải lên. Thầy cô có thể chọn ảnh khác hoặc bỏ ảnh." : ""}
    </div>
    <div className="post-image-picker__link-field">
      <label htmlFor={`${prefix}-image-link`}>Hoặc dán liên kết ảnh</label>
      <input className="post-image-picker__url" id={`${prefix}-image-link`} type="url" inputMode="url" pattern="https://.*" maxLength={2048} value={managedImage ? "" : coverUrl} onChange={(event) => changeLink(event.target.value)} disabled={disabled} placeholder="https://…" autoComplete="off" spellCheck={false} aria-describedby={description} aria-invalid={Boolean(displayedError)} />
      <p className="post-image-picker__help">Dùng liên kết bắt đầu bằng https:// nếu thầy cô đã có ảnh trên mạng.</p>
    </div>
    {displayedError && <p className="post-image-picker__error" id={`${prefix}-image-error`} role="alert">{displayedError}</p>}
  </div>;
}
