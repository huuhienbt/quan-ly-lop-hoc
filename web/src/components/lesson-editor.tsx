"use client";

import { useActionState, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { saveLearningPostAction } from "@/app/teacher/lesson-actions";
import { saveRichBulletinAction } from "@/app/teacher/actions";
import { vietnamToday, type ContentPost } from "@/lib/content-schemas";
import { decodeLesson, lessonAssetId, lessonColors, lessonDateLabel, lessonKinds, lessonWidths, MAX_LESSON_PDF, type LessonBlock, type LessonMarks, type LessonRun } from "@/lib/lessons";
import { editableRuns, emptyText, focusRich, readRich, readSelection, runLength, snapshotText, splitRich, writeRich, type TextBlock } from "@/lib/lesson-editing";
import { LessonRichBlock } from "./lesson-render";
import { PostImagePicker } from "./post-image-picker";
import "./lesson-composer.css";

type Media = Exclude<LessonBlock, TextBlock>;
type MediaType = Media["type"];
type Row = { key: number; block: LessonBlock };
type SavedSelection = NonNullable<ReturnType<typeof readSelection>>;
type Choice = { type: "media"; block: Media; key?: number } | { type: "fraction" } | null;
const mediaTools = [
  { type: "link", label: "Link", icon: "↗" }, { type: "image", label: "Ảnh", icon: "▧" },
  { type: "video", label: "Video", icon: "▶" }, { type: "audio", label: "Nghe", icon: "♫" }, { type: "pdf", label: "PDF", icon: "▤" },
] as const;
const mediaLabels: Record<MediaType, string> = { link: "Liên kết", image: "Hình ảnh", video: "Video", audio: "Âm thanh / MP3", pdf: "PDF" };
const symbols = ["×", "÷", "−", "±", "≠", "≤", "≥", "°", "²", "³", "√", "π", "½", "¼", "¾"];
const bulletinKinds = { NEWS: "Bản tin", ANNOUNCEMENT: "Thông báo", ACTIVITY: "Hoạt động" };

function createMedia(type: MediaType, width: typeof lessonWidths[number]): Media {
  if (type === "image") return { type, label: "", width };
  if (type === "pdf") return { type, label: "" };
  return { type, label: "", url: "" };
}

function startingBlocks(post: ContentPost | undefined, bulletin: boolean): LessonBlock[] {
  return decodeLesson(bulletin ? post?.bulletin_content : post?.lesson_content) ?? (post?.body
    ? (post.body.match(/[\s\S]{1,4000}/gu) ?? []).map(text => ({
      type: "text", text, align: "left", ...(bulletin ? { rich: [{ kind: "text", value: text }] } : {}),
    }))
    : [emptyText()]);
}

function Writer({ block, rowKey, bind, onEdit, remember, onKey, paste, disabled }: {
  block: TextBlock; rowKey: number; bind: (key: number, node: HTMLElement | null) => void;
  onEdit: (node: HTMLElement) => void; remember: (node: HTMLElement) => void;
  onKey: (event: KeyboardEvent<HTMLDivElement>) => void; paste: (text: string, node: HTMLElement) => void; disabled: boolean;
}) {
  const node = useRef<HTMLDivElement>(null);
  const first = useRef(block);
  useLayoutEffect(() => {
    if (node.current) writeRich(node.current, editableRuns(first.current));
  }, []);
  return <div ref={el => { node.current = el; bind(rowKey, el); }} contentEditable={!disabled} suppressContentEditableWarning
    role="textbox" aria-label="Đoạn văn bản" aria-multiline="true" aria-disabled={disabled} className="lesson-write"
    data-empty={block.text ? undefined : "true"} style={{ textAlign: block.align }}
    onFocus={e => remember(e.currentTarget)} onPointerUp={e => remember(e.currentTarget)} onKeyUp={e => remember(e.currentTarget)}
    onSelect={e => remember(e.currentTarget)} onInput={e => onEdit(e.currentTarget)}
    onKeyDown={onKey}
    onPaste={e => { e.preventDefault(); paste(e.clipboardData.getData("text/plain"), e.currentTarget); }}
    onDrop={e => e.preventDefault()} />;
}

function FractionPanel({ onAdd, close }: { onAdd: (run: LessonRun) => void; close: () => void }) {
  const id = useId();
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  return <section className="lesson-insert-panel" aria-labelledby={id}>
    <div className="lesson-insert-head"><strong id={id}>Chèn phân số</strong><button type="button" onClick={close} aria-label="Đóng công cụ phân số">×</button></div>
    <div className="lesson-fraction-fields">
      <label>Tử số<input value={top} maxLength={32} onChange={e => setTop(e.target.value)} /></label>
      <label>Mẫu số<input value={bottom} maxLength={32} onChange={e => setBottom(e.target.value)} /></label>
      <button type="button" className="lesson-insert-confirm" disabled={!top.trim() || !bottom.trim()} onClick={() => onAdd({ kind: "fraction", numerator: top.trim(), denominator: bottom.trim() })}>Chèn phân số</button>
    </div>
  </section>;
}

function MediaPanel({ initial, classId, onAdd, close, setUploading }: {
  initial: Media; classId: string; onAdd: (block: Media) => void; close: () => void; setUploading: (pending: boolean) => void;
}) {
  const id = useId();
  const [block, setBlock] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isUpload = block.type === "image" || block.type === "pdf";
  const existing = isUpload && block.assetId;
  async function confirm() {
    let result = block;
    if (file && (block.type === "image" || block.type === "pdf")) {
      if (!file.size || file.size > MAX_LESSON_PDF) { setError("Tệp không được vượt quá 3 MB."); return; }
      setPending(true); setUploading(true); setError("");
      const data = new FormData();
      data.set("class_id", classId); data.set("kind", block.type); data.set("file", file);
      try {
        const response = await fetch("/api/lesson-assets", { method:"POST", body:data });
        const body = await response.json().catch(() => null);
        if (!response.ok || !lessonAssetId.safeParse(body?.id).success) { setError(body?.message || "Chưa tải được tệp."); return; }
        result = { ...block, url: undefined, assetId: body.id, label: block.label || file.name.slice(0, 180) };
      } catch { setError("Kết nối bị gián đoạn. Thầy cô hãy thử lại."); return; }
      finally { setPending(false); setUploading(false); }
    }
    const parsed = decodeLesson(JSON.stringify([result]));
    if (!parsed) { setError("Vui lòng kiểm tra tên liên kết, nguồn HTTPS hoặc tệp đã chọn."); return; }
    onAdd(parsed[0] as Media);
  }
  return <section className="lesson-insert-panel" aria-labelledby={id}>
    <div className="lesson-insert-head"><strong id={id}>Chèn / sửa {mediaLabels[block.type]}</strong><button type="button" onClick={close} disabled={pending} aria-label="Đóng công cụ chèn tệp">×</button></div>
    <div className="lesson-media-fields">
      <label>{block.type === "link" ? "Tên liên kết" : "Chú thích"}<input value={block.label} maxLength={180} onChange={e => setBlock({ ...block, label: e.target.value })} /></label>
      <label>Đường dẫn HTTPS<input inputMode="url" value={block.url ?? ""} maxLength={2048} onChange={e => {
        setFile(null);
        setBlock(block.type === "image" || block.type === "pdf" ? { ...block, url: e.target.value || undefined, assetId: undefined } : { ...block, url: e.target.value });
      }} placeholder={block.type === "video" || block.type === "audio" ? "YouTube, Google Drive hoặc link tệp GitHub" : "https://…"} /></label>
      {isUpload && <label>{existing && !file ? "Đã có tệp · Chọn tệp mới" : "Hoặc chọn tệp từ máy (tối đa 3 MB)"}<input type="file"
        accept={block.type === "pdf" ? ".pdf,application/pdf" : "image/jpeg,image/png,image/webp"} onChange={e => {
          const picked = e.target.files?.[0]; if (!picked) return;
          setFile(picked);
          setBlock({ ...block, url: undefined, assetId: undefined });
        }} /></label>}
      {block.type === "image" && <label>Kích cỡ ảnh<select value={block.width} onChange={e => setBlock({ ...block, width: e.target.value as typeof block.width })}>
        {lessonWidths.map(size => <option key={size} value={size}>{size}%</option>)}
      </select></label>}
    </div>
    {error && <p className="teacher-feedback is-error" role="alert">{error}</p>}
    <button className="lesson-insert-confirm" type="button" disabled={pending} onClick={() => void confirm()}>{pending ? "Đang tải tệp…" : "Chèn vào nội dung"}</button>
  </section>;
}

export function LessonEditor({ classId, post, today, mode = "lesson" }: { classId: string; post?: ContentPost; today: string; mode?: "lesson" | "bulletin" }) {
  const bulletin = mode === "bulletin";
  const noun = bulletin ? "bài viết" : "bài học";
  const [initial] = useState(() => startingBlocks(post, bulletin));
  const [rows, setRows] = useState<Row[]>(() => initial.map((block, key) => ({ block, key })));
  const [title, setTitle] = useState(post?.title ?? "");
  const [kind, setKind] = useState<ContentPost["kind"]>(post?.kind ?? "NEWS");
  const [postDate, setPostDate] = useState(post?.post_date ?? (post?.published_at ? vietnamToday(new Date(post.published_at)) : today));
  const [visibility, setVisibility] = useState(post?.visibility ?? "PRIVATE");
  const [pinned, setPinned] = useState(post?.is_pinned === 1);
  const [coverUrl, setCoverUrl] = useState(post?.cover_url ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverReset, setCoverReset] = useState(0);
  const [preparingCover, setPreparingCover] = useState(false);
  const [tool, setTool] = useState<Choice>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [activeKey, setActiveKey] = useState(0);
  const [imageKey, setImageKey] = useState<number | null>(null);
  const [imageWidth, setImageWidth] = useState<typeof lessonWidths[number]>("60");
  const activeImage = rows.find(row => row.key === imageKey && row.block.type === "image")?.block;
  const nextKey = useRef(initial.length);
  const writers = useRef(new Map<number, HTMLElement>());
  const saved = useRef(new Map<number, SavedSelection>());
  const afterRenderFocus = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const [state, action, pending] = useActionState(async (previous: { success: boolean; message: string; fieldErrors?: Record<string, string[]> }, form: FormData) => {
    if (bulletin && coverFile) form.set("cover_image", coverFile);
    const result = await (bulletin ? saveRichBulletinAction : saveLearningPostAction)(previous, form);
    if (result.success && !post) {
      const key = nextKey.current++;
      setRows([{ key, block: emptyText() }]); setActiveKey(key);
      setTitle(""); setKind("NEWS"); setTool(null); setImageKey(null); saved.current.clear();
      setPostDate(today); setVisibility("PRIVATE"); setPinned(false);
      setCoverFile(null); setCoverUrl(""); setCoverReset(value => value + 1);
    }
    return result;
  }, { success: false, message: "" });

  useLayoutEffect(() => {
    if (afterRenderFocus.current === null) return;
    const node = writers.current.get(afterRenderFocus.current);
    if (node) focusRich(node, 0);
    afterRenderFocus.current = null;
  }, [rows]);

  function remember(key: number, node: HTMLElement) {
    setActiveKey(key); setImageKey(null);
    const range = readSelection(node);
    if (range) saved.current.set(key, range);
  }
  function setBlock(key: number, block: LessonBlock) {
    setRows(previous => previous.map(row => row.key === key ? { ...row, block } : row));
  }
  function context(key = activeKey, el?: HTMLElement) {
    const row = rows.find(row => row.key === key && row.block.type === "text") ?? rows.find(row => row.block.type === "text");
    if (!row || row.block.type !== "text") return null;
    const root = el ?? writers.current.get(row.key);
    if (!root) return null;
    const runs = readRich(root);
    const length = runLength(runs);
    const selection = readSelection(root) ?? saved.current.get(row.key) ?? { start:length, end:length, marks:{} };
    return { ...selection, start:Math.min(selection.start,length), end:Math.min(selection.end,length), runs, block:row.block, key:row.key, root };
  }
  function replace(runs: LessonRun[], key = activeKey, root?: HTMLElement) {
    const current = context(key, root);
    if (!current) return;
    const [before, rest] = splitRich(current.runs, current.start);
    const [, after] = splitRich(rest, current.end - current.start);
    const combined = [...before, ...runs.map(run => ({ ...run, marks: { ...current.marks, ...run.marks } })), ...after];
    writeRich(current.root, combined);
    setBlock(current.key, snapshotText(current.block, combined));
    focusRich(current.root, current.start + runLength(runs));
    remember(current.key, current.root);
  }
  function format(mark: keyof LessonMarks, color?: LessonMarks["color"], key = activeKey) {
    const current = context(key);
    if (!current) return;
    const [before, rest] = splitRich(current.runs, current.start);
    const [chosen, after] = splitRich(rest, current.end - current.start);
    const value = mark === "color" ? color : !(chosen.length ? chosen.every(run => run.marks?.[mark]) : current.marks[mark]);
    const marks = { ...current.marks, [mark]: value };
    const combined = [...before, ...chosen.map(run => ({ ...run, marks: { ...run.marks, [mark]: value } })), ...after];
    writeRich(current.root, combined);
    setBlock(current.key, snapshotText(current.block, combined));
    focusRich(current.root, current.start, current.end, current.start === current.end ? marks : undefined);
    remember(current.key, current.root);
  }
  function splitParagraph(key: number, node: HTMLElement) {
    const current = context(key, node);
    if (!current) return;
    if (rows.length >= 24) { replace([{ kind:"text", value:"\n" }], key, node); return; }
    const [left, rest] = splitRich(current.runs, current.start);
    const [, right] = splitRich(rest, current.end - current.start);
    const newKey = nextKey.current++;
    writeRich(node, left);
    afterRenderFocus.current = newKey;
    setRows(previous => previous.flatMap(row => row.key !== key ? [row] : [
      { key, block: snapshotText(current.block, left) },
      { key: newKey, block: snapshotText(current.block, right) },
    ]));
  }
  function onKey(event: KeyboardEvent<HTMLDivElement>, key: number) {
    if (event.nativeEvent.isComposing) return;
    const marks = { b:"bold", i:"italic", u:"underline" } as const;
    const shortcut = event.key.toLowerCase() as keyof typeof marks;
    if ((event.ctrlKey || event.metaKey) && marks[shortcut]) {
      event.preventDefault(); format(marks[shortcut], undefined, key); return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) replace([{ kind:"text", value:"\n" }], key, event.currentTarget);
      else splitParagraph(key, event.currentTarget);
    }
  }
  function saveMedia(block: Media, editKey?: number) {
    if (editKey !== undefined) {
      setBlock(editKey, block);
      if (block.type === "image") { setImageKey(editKey); setImageWidth(block.width); }
    } else {
      const key = nextKey.current++, textKey = nextKey.current++;
      const current = context();
      if (current) {
        const [left, right] = splitRich(current.runs, current.end);
        writeRich(current.root, left);
        setRows(previous => previous.flatMap(row => row.key !== current.key ? [row] : [
          { key:current.key, block:snapshotText(current.block,left) }, { key, block }, { key:textKey, block:snapshotText(current.block,right) },
        ]));
      } else {
        setRows(previous => [...previous, { key, block }, { key:textKey, block:emptyText() }]);
      }
      afterRenderFocus.current = textKey;
    }
    setTool(null);
  }
  function align(value: TextBlock["align"]) {
    const current = context();
    if (current) {
      setBlock(current.key, { ...snapshotText(current.block,current.runs), align:value });
      writeRich(current.root, current.runs); focusRich(current.root, current.start, current.end);
    }
  }
  function close() {
    const panel = formRef.current?.closest("details");
    if (panel) { panel.open = false; panel.querySelector("summary")?.focus(); }
  }
  function moveAttachment(key: number, direction: number) {
    setRows(previous => {
      const index = previous.findIndex(row => row.key === key);
      const other = index + direction;
      if (index < 0 || other < 0 || other >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  }

  const payload = JSON.stringify(rows.map(row => row.block).filter(block => block.type !== "text" || block.text.trim()));
  const mouse = (event: React.MouseEvent) => event.preventDefault();
  return <form className="lesson-composer" action={action} ref={formRef} data-lesson-composer onSubmit={event => {
    if (uploading || preparingCover || tool || !decodeLesson(payload)) {
      event.preventDefault();
      setError(tool ? "Hãy chèn hoặc đóng công cụ đang mở trước khi lưu." : "Hãy nhập nội dung hợp lệ, tối đa 24 khối và 48.000 ký tự lưu trữ.");
    } else setError("");
  }}>
    <input type="hidden" name="class_id" value={classId} />
    {post && <input type="hidden" name="id" value={post.id} />}
    {bulletin && <input type="hidden" name="category" value={post?.category ?? "GENERAL"} />}
    <input type="hidden" name={bulletin ? "bulletin_content" : "document"} value={payload} />
    <div className="lesson-composer-head">
      <button type="button" className="lesson-close" aria-label="Đóng khung soạn" onClick={close} disabled={pending || uploading || preparingCover}>×</button>
      <h3>{post ? `Chỉnh sửa ${noun}` : `Tạo ${noun} mới`}</h3>
    </div>
    <fieldset className="lesson-composer-fields" disabled={pending || uploading}>
      <legend className="sr-only">Soạn {noun}</legend>
      <div className="lesson-meta">
        <label>Loại bài viết<select name="kind" value={kind} onChange={e => setKind(e.target.value as ContentPost["kind"])}>
          {Object.entries(bulletin ? bulletinKinds : lessonKinds).map(([value,label]) => <option value={value} key={value}>{label}</option>)}
        </select></label>
        <label>Ngày đăng<input type="date" name="post_date" required max={today} value={postDate} onChange={e => setPostDate(e.target.value)}
          aria-describedby={`${prefix}-post-date-note`} />
          <small className="lesson-date-note" id={`${prefix}-post-date-note`}>{postDate ? lessonDateLabel(postDate) : "Chọn ngày hiển thị trên bài."}</small>
        </label>
        <label className="lesson-name">Tiêu đề<input name="title" required maxLength={200} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) e.preventDefault(); }} placeholder={`Nhập tiêu đề ${noun}`} /></label>
        {bulletin &&
          <label className="lesson-visibility">Ai được xem<select name="visibility" value={visibility} onChange={e => setVisibility(e.target.value as typeof visibility)}>
            <option value="PRIVATE">Chỉ trong lớp</option><option value="PUBLIC">Công khai trên trang chủ</option>
          </select></label>
        }
      </div>
      <p className="lesson-editor-label" id={prefix}>Nội dung</p>
      <div className="lesson-toolbar" role="group" aria-label="Công cụ soạn bài">
        <div className="lesson-tool-group">
          <button aria-label="In đậm" type="button" onMouseDown={mouse} onClick={() => format("bold")}><strong>B</strong></button>
          <button aria-label="In nghiêng" type="button" onMouseDown={mouse} onClick={() => format("italic")}><em>I</em></button>
          <button aria-label="Gạch chân" type="button" onMouseDown={mouse} onClick={() => format("underline")}><u>U</u></button>
          <label className="lesson-color-control" aria-label="Màu chữ"><span aria-hidden="true">◼</span><select aria-label="Màu chữ" value="" onChange={e => { if (e.target.value) format("color",e.target.value as LessonMarks["color"]); }}>
            <option value="">Màu chữ</option>{["Mặc định", "Đỏ", "Nâu", "Xanh lá", "Xanh dương", "Tím"].map((label,i) => <option key={label} value={lessonColors[i]}>{label}</option>)}
          </select></label>
        </div>
        <div className="lesson-tool-group">
          {(["left","center","right"] as const).map((side,i) => <button type="button" aria-label={["Căn trái","Căn giữa","Căn phải"][i]} key={side} onMouseDown={mouse} onClick={() => align(side)}>
            <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={["M2 3h12M2 6h8M2 9h12M2 12h8","M2 3h12M4 6h8M2 9h12M4 12h8","M2 3h12M6 6h8M2 9h12M6 12h8"][i]} /></svg>
          </button>)}
        </div>
        <button className="tool-blank" type="button" onMouseDown={mouse} onClick={() => replace([{ kind:"blank" }])}>□ Ô trống</button>
        <button className="tool-fraction" type="button" aria-expanded={tool?.type === "fraction"} onMouseDown={mouse} onClick={() => setTool(tool?.type === "fraction" ? null : {type:"fraction"})}>÷ Phân số</button>
        {mediaTools.map(({ type,label,icon }) => <button key={type} className={`tool-${type}`} type="button" disabled={rows.length > 22}
          onMouseDown={mouse} onClick={() => { setError(""); setTool(tool?.type === "media" && tool.block.type === type && tool.key === undefined ? null : { type:"media", block:createMedia(type,imageWidth) }); }}><span aria-hidden="true">{icon}</span> {label}</button>)}
        <select aria-label="Ký hiệu" value="" onChange={e => { if (e.target.value) replace([{ kind:"text", value:e.target.value }]); }}>
          <option value="">Ký hiệu</option>{symbols.map(symbol => <option key={symbol}>{symbol}</option>)}
        </select>
        <select aria-label="Cỡ ảnh" value={activeImage?.type === "image" ? activeImage.width : ""} onChange={e => {
          const width = e.target.value as typeof lessonWidths[number]; if (!width) return;
          setImageWidth(width);
          if (activeImage?.type === "image" && imageKey !== null) setBlock(imageKey, { ...activeImage,width });
        }}>
          <option value="">Cỡ ảnh</option>{lessonWidths.map(size => <option key={size} value={size}>{size}%</option>)}
        </select>
      </div>
      {tool?.type === "fraction" && <FractionPanel onAdd={run => {replace([run]); setTool(null);}} close={() => setTool(null)} />}
      {tool?.type === "media" && <MediaPanel key={`${tool.block.type}-${tool.key}`} initial={tool.block} classId={classId} onAdd={block => saveMedia(block,tool.key)} close={() => setTool(null)} setUploading={setUploading} />}
      <div className="lesson-sheet" role="group" aria-labelledby={prefix}>
        {rows.map(({key,block}, index) => block.type === "text"
          ? <Writer key={key} rowKey={key} block={block} disabled={pending || uploading} bind={(key,node) => { if (node) writers.current.set(key,node); else writers.current.delete(key); }}
              remember={node => remember(key,node)} onKey={event => onKey(event,key)}
              onEdit={node => { setBlock(key,snapshotText(block,readRich(node))); remember(key,node); }}
              paste={(text,node) => { if (text) replace([{ kind:"text", value:text }],key,node); }} />
          : <section className={`lesson-attachment${imageKey === key ? " is-active" : ""}`} key={key} aria-label={mediaLabels[block.type]}>
              <div className="lesson-attachment-tools">
                <strong>{mediaLabels[block.type]}</strong>
                {block.type === "image" && <button type="button" aria-pressed={imageKey === key} onClick={() => setImageKey(key)}>Chọn ảnh · {block.width}%</button>}
                <button type="button" onClick={() => setTool({ type:"media", block,key })}>Sửa</button>
                <button type="button" aria-label="Đưa tệp lên" disabled={!index} onClick={() => moveAttachment(key,-1)}>↑</button>
                <button type="button" aria-label="Đưa tệp xuống" disabled={index === rows.length - 1} onClick={() => moveAttachment(key,1)}>↓</button>
                <button type="button" aria-label={`Bỏ ${mediaLabels[block.type]}`} onClick={() => { if (tool?.type === "media" && tool.key === key) setTool(null); setRows(previous => previous.filter(row => row.key !== key)); }}>Bỏ</button>
              </div>
              <LessonRichBlock block={block} preview />
            </section>)}
      </div>
      {bulletin && <div className="lesson-bulletin-options">
        <details className="lesson-cover"><summary>Ảnh bìa bản tin{coverUrl || coverFile ? " · Đã chọn" : " (không bắt buộc)"}</summary>
          <PostImagePicker prefix={prefix} coverUrl={coverUrl} onCoverUrlChange={setCoverUrl} onFileChange={setCoverFile}
            onProcessingChange={setPreparingCover} disabled={pending || uploading} resetKey={coverReset} error={state.fieldErrors?.cover_url?.join(" ")} />
        </details>
        <label className="lesson-pin"><input type="checkbox" name="is_pinned" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Ghim lên đầu các bài cùng ngày</label>
      </div>}
      {(error || state.message) && <p className={`teacher-feedback ${!error && state.success ? "is-success" : "is-error"}`} role={!error && state.success ? "status" : "alert"}>{error || state.message}</p>}
      <div className="lesson-composer-actions">
        <button type="submit" name="status" value="PUBLISHED" className="lesson-publish" disabled={!!tool || preparingCover}>{uploading ? "Đang tải tệp…" : preparingCover ? "Đang chuẩn bị ảnh bìa…" : pending ? "Đang lưu…" : "Đăng lên hệ thống"}</button>
        <button type="submit" name="status" value="DRAFT" className="lesson-draft" disabled={!!tool || preparingCover}>Lưu nháp</button>
        <span>{bulletin && visibility === "PUBLIC" ? "Mọi người có thể xem bài và tệp chèn trong bài sau khi đăng." : "Chỉ học sinh của lớp xem được bài đã đăng."}</span>
      </div>
    </fieldset>
  </form>;
}
