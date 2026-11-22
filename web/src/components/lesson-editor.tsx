"use client";

import { useActionState, useId, useRef, useState } from "react";
import { saveLearningPostAction } from "@/app/teacher/lesson-actions";
import type { ContentPost } from "@/lib/content-schemas";
import { decodeLesson, lessonAssetId, MAX_LESSON_IMAGE, MAX_LESSON_PDF, type LessonBlock } from "@/lib/lessons";
import { LessonRichBlock } from "./lesson-render";

const labels = { text: "Văn bản", image: "Hình ảnh", link: "Liên kết", pdf: "PDF", video: "Video", audio: "Âm thanh / MP3" };
const symbols = ["×", "÷", "−", "±", "≠", "≤", "≥", "°", "²", "³", "√", "π", "½", "¼", "¾"];
type Row = { key: number; block: LessonBlock };

function newBlock(type: LessonBlock["type"]): LessonBlock {
  if (type === "text") return { type, text: "", align: "left" };
  if (type === "image") return { type, label: "", width: "60" };
  if (type === "pdf") return { type, label: "" };
  return { type, label: "", url: "" };
}

function TextEditor({ block, change }: { block: Extract<LessonBlock, { type: "text" }>; change: (block: LessonBlock) => void }) {
  const inputId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [fraction, setFraction] = useState(false);
  const [numerator, setNumerator] = useState("");
  const [denominator, setDenominator] = useState("");
  const selection = useRef<[number, number]>([0, 0]);
  function replace(value: string, retain?: [number, number]) {
    const [start, end] = selection.current;
    const next = block.text.slice(0, start) + value + block.text.slice(end);
    if (next.length > 8000) return;
    change({ ...block, text: next });
    selection.current = retain ? [start + retain[0], start + retain[1]] : [start + value.length, start + value.length];
    requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(...selection.current); });
  }
  function format(marker: string) {
    const [start, end] = selection.current;
    const selected = block.text.slice(start, end);
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
      replace(selected.slice(marker.length, -marker.length));
    } else {
      const content = selected || "văn bản";
      replace(marker + content + marker, [marker.length, marker.length + content.length]);
    }
  }
  const fractionValid = [numerator, denominator].every(value => /^[^|\]\n]{1,32}$/.test(value.trim()));
  return <div className="lesson-text-editor">
    <div className="lesson-tools" aria-label="Định dạng văn bản">
      <button type="button" onClick={() => format("**")} aria-label="In đậm"><strong>Đậm</strong></button>
      <button type="button" onClick={() => format("*")} aria-label="In nghiêng"><em>Nghiêng</em></button>
      <button type="button" onClick={() => format("__")} aria-label="Gạch chân"><u>Gạch chân</u></button>
      <button type="button" aria-expanded={fraction} onClick={() => setFraction(!fraction)}>Phân số</button>
      <label className="lesson-compact-label">Căn chữ <select value={block.align} onChange={(e) => change({ ...block, align: e.target.value as typeof block.align })}><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select></label>
      <label className="lesson-compact-label">Ký hiệu <select value="" onChange={e => { if (e.target.value) replace(e.target.value); }}><option value="">Chọn ký hiệu</option>{symbols.map(symbol => <option key={symbol}>{symbol}</option>)}</select></label>
    </div>
    {fraction && <div className="lesson-fraction-tools">
      <label>Tử số<input value={numerator} maxLength={32} onChange={e => setNumerator(e.target.value)} /></label>
      <label>Mẫu số<input value={denominator} maxLength={32} onChange={e => setDenominator(e.target.value)} /></label>
      <button type="button" disabled={!fractionValid} onClick={() => {
        replace(`[[frac:${numerator.trim()}|${denominator.trim()}]]`);
        setFraction(false); setNumerator(""); setDenominator("");
      }}>Chèn phân số</button>
    </div>}
    <label className="sr-only" htmlFor={inputId}>Văn bản của khối</label>
    <textarea id={inputId} ref={field} rows={4} maxLength={8000} value={block.text}
      onSelect={e => { selection.current = [e.currentTarget.selectionStart, e.currentTarget.selectionEnd]; }}
      onChange={e => {
        selection.current = [e.currentTarget.selectionStart, e.currentTarget.selectionEnd];
        change({ ...block, text: e.target.value });
      }} placeholder="Nhập nội dung. Bôi đen chữ rồi chọn định dạng." />
    {block.text.trim() && <div className="lesson-preview"><span>Xem trước</span><LessonRichBlock block={block} preview /></div>}
  </div>;
}

function MediaEditor({ block, classId, change, uploading, setUploading }: {
  block: Exclude<LessonBlock, { type: "text" }>; classId: string; change: (block: LessonBlock) => void;
  uploading: boolean; setUploading: (value: boolean) => void;
}) {
  const [error, setError] = useState("");
  const canUpload = block.type === "image" || block.type === "pdf";
  const local = canUpload && block.assetId;
  async function upload(file: File) {
    if (uploading || (block.type !== "image" && block.type !== "pdf")) return;
    setError("");
    if (file.size > (block.type === "pdf" ? MAX_LESSON_PDF : MAX_LESSON_IMAGE)) {
      setError("Tệp lớn hơn 3 MB. Hãy dùng tệp nhỏ hơn hoặc chèn liên kết."); return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.set("class_id", classId);
      data.set("kind", block.type);
      data.set("file", file);
      const response = await fetch("/api/lesson-assets", { method: "POST", body: data });
      const result = await response.json().catch(() => null);
      if (!response.ok || !lessonAssetId.safeParse(result?.id).success) {
        setError(result?.message || "Chưa tải được tệp. Thầy cô thử lại nhé."); return;
      }
      change({ ...block, url: undefined, assetId: result.id, label: block.label || file.name.slice(0, 180) });
    } catch { setError("Kết nối bị gián đoạn. Thầy cô hãy thử lại."); }
    finally { setUploading(false); }
  }
  return <div className="lesson-media-editor">
    <label>{block.type === "link" ? "Tên liên kết" : "Chú thích"}<input value={block.label} maxLength={180}
      onChange={e => change({ ...block, label: e.target.value })} placeholder={block.type === "link" ? "Ví dụ: Xem bài tập" : "Tên tài liệu hoặc mô tả ảnh"} /></label>
    <label>{local ? "Dùng đường dẫn thay cho tệp" : "Đường dẫn HTTPS"}<input type="url" value={block.url ?? ""} maxLength={2048}
      onChange={e => change(canUpload ? { ...block, url: e.target.value || undefined, assetId: undefined } : { ...block, url: e.target.value })}
      placeholder={block.type === "video" || block.type === "audio" ? "YouTube, Google Drive hoặc liên kết tệp GitHub" : "https://…"} /></label>
    {canUpload && <div className="lesson-upload"><label>{local ? "Đã tải tệp · Chọn tệp khác" : "Chọn tệp từ máy (tối đa 3 MB)"}
      <input type="file" accept={block.type === "pdf" ? ".pdf,application/pdf" : "image/jpeg,image/png,image/webp"} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file);
      }} /></label>
      {local && <button type="button" onClick={() => change({ ...block, assetId: undefined })}>Bỏ tệp</button>}
    </div>}
    {block.type === "image" && <label className="lesson-compact-label">Chiều rộng ảnh <select value={block.width} onChange={e => change({ ...block, width: e.target.value as typeof block.width })}>
      {["25", "40", "60", "80", "100"].map(width => <option key={width} value={width}>{width}%</option>)}</select></label>}
    {error && <p className="teacher-feedback is-error" role="alert">{error}</p>}
    {(block.url || local) && <div className="lesson-preview"><span>Xem trước</span><LessonRichBlock block={block} preview /></div>}
  </div>;
}

export function LessonEditor({ classId, post }: { classId: string; post?: ContentPost }) {
  const loaded = decodeLesson(post?.lesson_content) ?? (post?.body ? [{ type: "text" as const, text: post.body, align: "left" as const }] : [newBlock("text")]);
  const [rows, setRows] = useState<Row[]>(() => loaded.map((block, key) => ({ block, key })));
  const nextKey = useRef(loaded.length);
  const [title, setTitle] = useState(post?.title ?? "");
  const [status, setStatus] = useState(post?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [state, action, pending] = useActionState(async (previous: { success: boolean; message: string }, form: FormData) => {
    const result = await saveLearningPostAction(previous, form);
    if (result.success && !post) {
      setRows([{ block: newBlock("text"), key: nextKey.current++ }]);
      setTitle(""); setStatus("DRAFT");
    }
    return result;
  }, { success: false, message: "" });
  const document = JSON.stringify(rows.map(row => row.block).filter(block => block.type !== "text" || block.text.trim()));
  function move(index: number, delta: number) {
    setRows(previous => {
      const other = index + delta;
      if (other < 0 || other >= previous.length) return previous;
      const copy = [...previous];
      [copy[index], copy[other]] = [copy[other], copy[index]];
      return copy;
    });
  }
  return <form className="teacher-editor-form lesson-editor" action={action} onSubmit={event => {
    if (uploading || !decodeLesson(document)) {
      event.preventDefault();
      setError(uploading ? "Vui lòng đợi tải tệp xong." : "Bài học cần có ít nhất một khối hợp lệ. Kiểm tra liên kết HTTPS và các khối chưa điền.");
    } else setError("");
  }}>
    <input type="hidden" name="class_id" value={classId} />
    {post && <input type="hidden" name="id" value={post.id} />}
    <input type="hidden" name="document" value={document} />
    <fieldset disabled={pending || uploading}>
      <legend className="sr-only">Soạn bài học</legend>
      <label className="lesson-title">Tiêu đề bài học<input name="title" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Toán 4 – Luyện tập về phân số" /></label>
      <div className="lesson-add"><span>Thêm nội dung</span><div className="lesson-tools">
        {(Object.keys(labels) as LessonBlock["type"][]).map(type => <button key={type} type="button" disabled={rows.length >= 24} onClick={() => {
          const key = nextKey.current++;
          setRows(previous => [...previous, { key, block: newBlock(type) }]);
        }}>＋ {labels[type]}</button>)}
      </div></div>
      <div className="lesson-rows">
        {rows.map(({ key, block }, index) => {
          const change = (next: LessonBlock) => setRows(previous => previous.map(row => row.key === key ? { ...row, block: next } : row));
          return <section key={key} className="lesson-row" aria-label={`Khối ${index + 1}: ${labels[block.type]}`}>
            <div className="lesson-row-head"><strong>{index + 1}. {labels[block.type]}</strong><div className="lesson-tools">
              <button type="button" aria-label="Đưa khối lên" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
              <button type="button" aria-label="Đưa khối xuống" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>↓</button>
              <button type="button" aria-label="Xóa khối nội dung" onClick={() => setRows(previous => previous.filter(row => row.key !== key))}>Bỏ</button>
            </div></div>
            {block.type === "text" ? <TextEditor block={block} change={change} />
              : <MediaEditor block={block} change={change} classId={classId} uploading={uploading} setUploading={setUploading} />}
          </section>;
        })}
      </div>
      <label className="lesson-compact-label">Trạng thái <select name="status" value={status} onChange={e => setStatus(e.target.value)}><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Xuất bản cho lớp</option></select></label>
      <p className="teacher-field-help">Chỉ học sinh của lớp xem được bài đã xuất bản. Liên kết bên ngoài cần có quyền xem phù hợp.</p>
      {(error || state.message) && <p className={`teacher-feedback ${!error && state.success ? "is-success" : "is-error"}`} role={!error && state.success ? "status" : "alert"}>{error || state.message}</p>}
      <button type="submit" className="button button-primary full-width">{uploading ? "Đang tải tệp…" : pending ? "Đang lưu…" : "Lưu bài học"}</button>
    </fieldset>
  </form>;
}
