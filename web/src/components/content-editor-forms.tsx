"use client";

import { useActionState, useId, useState } from "react";
import { archiveContentAction, saveEventAction, savePostAction, saveTaskAction, type ContentActionState } from "@/app/teacher/actions";
import type { ClassEvent, ClassTask, ContentPost } from "@/lib/content-schemas";
import { PostImagePicker } from "@/components/post-image-picker";

const emptyState: ContentActionState = { success: false, message: "" };
type EditorAction = (state: ContentActionState, formData: FormData) => Promise<ContentActionState>;

function useEditorState<T extends object>(action: EditorAction, initial: T, resetOnSuccess: boolean) {
  const [values, setValues] = useState(initial);
  const [state, formAction, pending] = useActionState(async (previous: ContentActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.success && resetOnSuccess) setValues(initial);
    return result;
  }, emptyState);
  function setField<K extends keyof T>(key: K, value: T[K]) { setValues((previous) => ({ ...previous, [key]: value })); }
  return { values, setField, state, formAction, pending };
}

function Feedback({ state }: { state: ContentActionState }) {
  return state.message ? <p className={`teacher-feedback ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null;
}

function FieldError({ state, name, prefix }: { state: ContentActionState; name: string; prefix: string }) {
  return state.fieldErrors?.[name]?.length ? <p className="teacher-field-error" id={`${prefix}-${name}-error`}>{state.fieldErrors[name].join(" ")}</p> : null;
}

function inputErrors(state: ContentActionState, name: string, prefix: string) {
  return { "aria-invalid": !!state.fieldErrors?.[name], "aria-describedby": state.fieldErrors?.[name]?.length ? `${prefix}-${name}-error` : undefined };
}

function PublicationFields({ prefix, state, status, isPublic, onStatus, onVisibility, noun }: {
  prefix: string; state: ContentActionState; status: string; isPublic: boolean;
  onStatus: (value: string) => void; onVisibility: (value: boolean) => void; noun: string;
}) {
  return <>
    <div className="teacher-field"><label htmlFor={`${prefix}-status`}>Trạng thái {noun}</label><select id={`${prefix}-status`} name="status" value={status} onChange={(event) => onStatus(event.target.value)} {...inputErrors(state, "status", prefix)}><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Xuất bản</option></select><FieldError state={state} name="status" prefix={prefix} /></div>
    <input type="hidden" name="visibility" value={isPublic ? "PUBLIC" : "PRIVATE"} />
    <div className="teacher-publication-note"><label className="teacher-checkbox"><input type="checkbox" id={`${prefix}-visibility`} checked={isPublic} onChange={(event) => onVisibility(event.target.checked)} /><span>Công khai trên trang chủ</span></label><p>{isPublic ? "Sau khi xuất bản, nội dung này xuất hiện ở trang chủ và mọi người đều có thể xem. Vui lòng kiểm tra thông tin riêng tư trước khi đăng." : "Nội dung đã xuất bản chỉ hiển thị trong lớp cho học sinh đăng nhập. Bật công khai nếu thầy cô muốn chia sẻ ở trang chủ."}</p><FieldError state={state} name="visibility" prefix={prefix} /></div>
  </>;
}

interface PostValues { title: string; body: string; kind: string; category: string; cover_url: string; status: string; isPublic: boolean; is_pinned: boolean }

export function PostEditorForm({ classId, post }: { classId: string; post?: ContentPost }) {
  const prefix = useId();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [processingImage, setProcessingImage] = useState(false);
  const [imageReset, setImageReset] = useState(0);
  const initial: PostValues = { title: post?.title ?? "", body: post?.body ?? "", kind: post?.kind ?? "NEWS", category: post?.category ?? "GENERAL", cover_url: post?.cover_url ?? "", status: post?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT", isPublic: post?.visibility === "PUBLIC", is_pinned: post?.is_pinned === 1 };
  const { values, setField, state, formAction, pending } = useEditorState(async (previous, formData) => {
    if (selectedImage) formData.set("cover_image", selectedImage);
    const result = await savePostAction(previous, formData);
    if (result.success) {
      setSelectedImage(null);
      setImageReset((value) => value + 1);
    }
    return result;
  }, initial, !post);
  return <form className="teacher-editor-form" action={formAction} onSubmit={(event) => { if (processingImage) event.preventDefault(); }} data-content-form="post" data-mode={post ? "edit" : "create"} aria-busy={pending || processingImage}>
    <input type="hidden" name="class_id" value={classId} />{post && <input type="hidden" name="id" value={post.id} />}
    <fieldset disabled={pending}><legend className="sr-only">{post ? "Chỉnh sửa bài viết" : "Tạo bài viết mới"}</legend>
      <div className="teacher-field"><label htmlFor={`${prefix}-title`}>Tiêu đề bài viết</label><input id={`${prefix}-title`} name="title" required maxLength={200} value={values.title} onChange={(event) => setField("title", event.target.value)} placeholder="Một câu chuyện nhỏ, một niềm vui lớn…" {...inputErrors(state, "title", prefix)} /><FieldError state={state} name="title" prefix={prefix} /></div>
      <div className="teacher-form-row"><div className="teacher-field"><label htmlFor={`${prefix}-kind`}>Loại bài viết</label><select id={`${prefix}-kind`} name="kind" value={values.kind} onChange={(event) => setField("kind", event.target.value)} {...inputErrors(state, "kind", prefix)}><option value="NEWS">Bảng tin</option><option value="ANNOUNCEMENT">Thông báo</option><option value="ACTIVITY">Hoạt động</option></select><FieldError state={state} name="kind" prefix={prefix} /></div><div className="teacher-field"><label htmlFor={`${prefix}-category`}>Chuyên mục</label><select id={`${prefix}-category`} name="category" value={values.category} onChange={(event) => setField("category", event.target.value)} {...inputErrors(state, "category", prefix)}><option value="GENERAL">Tin chung</option><option value="CLASS_STORY">Chuyện lớp mình</option><option value="KINDNESS">Điều tử tế</option><option value="PARENT_GUIDE">Đồng hành cùng con</option><option value="DISCOVERY">Góc khám phá</option></select><FieldError state={state} name="category" prefix={prefix} /></div></div>
      <div className="teacher-field"><label htmlFor={`${prefix}-body`}>Nội dung bài viết</label><textarea id={`${prefix}-body`} name="body" required maxLength={20000} rows={7} value={values.body} onChange={(event) => setField("body", event.target.value)} placeholder="Thầy cô chia sẻ câu chuyện, thông báo hoặc hoạt động của lớp tại đây." {...inputErrors(state, "body", prefix)} /><FieldError state={state} name="body" prefix={prefix} /></div>
      <PostImagePicker prefix={prefix} coverUrl={values.cover_url} onCoverUrlChange={(value) => setField("cover_url", value)} onFileChange={setSelectedImage} onProcessingChange={setProcessingImage} disabled={pending} error={state.fieldErrors?.cover_url?.join(" ")} resetKey={imageReset} />
      <PublicationFields prefix={prefix} state={state} status={values.status} isPublic={values.isPublic} onStatus={(value) => setField("status", value)} onVisibility={(value) => setField("isPublic", value)} noun="bài viết" />
      <label className="teacher-checkbox"><input type="checkbox" name="is_pinned" checked={values.is_pinned} onChange={(event) => setField("is_pinned", event.target.checked)} /> Ghim bài viết lên đầu bảng tin</label><FieldError state={state} name="is_pinned" prefix={prefix} />
      <Feedback state={state} /><button className="button button-primary full-width teacher-submit" type="submit" disabled={processingImage}>{processingImage ? "Đang chuẩn bị ảnh…" : pending ? "Đang lưu bài viết…" : post ? "Lưu thay đổi bài viết" : "Lưu bài viết"}</button>
    </fieldset>
  </form>;
}

interface EventValues { title: string; body: string; event_date: string; starts_at: string; status: string; isPublic: boolean }

export function EventEditorForm({ classId, today, event }: { classId: string; today: string; event?: ClassEvent }) {
  const prefix = useId();
  const initial: EventValues = { title: event?.title ?? "", body: event?.body ?? "", event_date: event?.event_date ?? today, starts_at: event?.starts_at ?? "", status: event?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT", isPublic: event?.visibility === "PUBLIC" };
  const { values, setField, state, formAction, pending } = useEditorState(saveEventAction, initial, !event);
  return <form className="teacher-editor-form" action={formAction} data-content-form="event" data-mode={event ? "edit" : "create"} aria-busy={pending}>
    <input type="hidden" name="class_id" value={classId} />{event && <input type="hidden" name="id" value={event.id} />}
    <fieldset disabled={pending}><legend className="sr-only">{event ? "Chỉnh sửa sự kiện" : "Tạo sự kiện mới"}</legend>
      <div className="teacher-field"><label htmlFor={`${prefix}-title`}>Tên sự kiện</label><input id={`${prefix}-title`} name="title" required maxLength={200} value={values.title} onChange={(entry) => setField("title", entry.target.value)} placeholder="Ví dụ: Sinh hoạt lớp cuối tuần" {...inputErrors(state, "title", prefix)} /><FieldError state={state} name="title" prefix={prefix} /></div>
      <div className="teacher-form-row"><div className="teacher-field"><label htmlFor={`${prefix}-date`}>Ngày diễn ra</label><input id={`${prefix}-date`} name="event_date" type="date" required value={values.event_date} onChange={(entry) => setField("event_date", entry.target.value)} {...inputErrors(state, "event_date", prefix)} /><FieldError state={state} name="event_date" prefix={prefix} /></div><div className="teacher-field"><label htmlFor={`${prefix}-time`}>Giờ bắt đầu <span>(không bắt buộc)</span></label><input id={`${prefix}-time`} name="starts_at" type="time" step={60} value={values.starts_at} onChange={(entry) => setField("starts_at", entry.target.value)} {...inputErrors(state, "starts_at", prefix)} /><FieldError state={state} name="starts_at" prefix={prefix} /></div></div>
      <div className="teacher-field"><label htmlFor={`${prefix}-body`}>Mô tả sự kiện</label><textarea id={`${prefix}-body`} name="body" rows={4} maxLength={4000} value={values.body} onChange={(entry) => setField("body", entry.target.value)} placeholder="Những điều học sinh và ba mẹ cần biết…" {...inputErrors(state, "body", prefix)} /><FieldError state={state} name="body" prefix={prefix} /></div>
      <PublicationFields prefix={prefix} state={state} status={values.status} isPublic={values.isPublic} onStatus={(value) => setField("status", value)} onVisibility={(value) => setField("isPublic", value)} noun="sự kiện" />
      <Feedback state={state} /><button className="button button-primary full-width teacher-submit" type="submit">{pending ? "Đang lưu sự kiện…" : event ? "Lưu thay đổi sự kiện" : "Lưu sự kiện"}</button>
    </fieldset>
  </form>;
}

interface TaskValues { title: string; details: string; kind: string; task_date: string; sort_order: string }

export function TaskEditorForm({ classId, task }: { classId: string; task?: ClassTask }) {
  const prefix = useId();
  const initial: TaskValues = { title: task?.title ?? "", details: task?.details ?? "", kind: task?.kind ?? "TODO", task_date: task?.task_date ?? "", sort_order: String(task?.sort_order ?? 0) };
  const { values, setField, state, formAction, pending } = useEditorState(saveTaskAction, initial, !task);
  return <form className="teacher-editor-form" action={formAction} data-content-form="task" data-mode={task ? "edit" : "create"} aria-busy={pending}>
    <input type="hidden" name="class_id" value={classId} />{task && <input type="hidden" name="id" value={task.id} />}
    <fieldset disabled={pending}><legend className="sr-only">{task ? "Chỉnh sửa việc cần làm" : "Tạo việc cần làm"}</legend>
      <div className="teacher-field"><label htmlFor={`${prefix}-title`}>Tên việc cần làm</label><input id={`${prefix}-title`} name="title" required maxLength={200} value={values.title} onChange={(event) => setField("title", event.target.value)} placeholder="Ví dụ: Chuẩn bị sách vở cho ngày mai" {...inputErrors(state, "title", prefix)} /><FieldError state={state} name="title" prefix={prefix} /></div>
      <div className="teacher-field"><label htmlFor={`${prefix}-kind`}>Nhóm công việc</label><select id={`${prefix}-kind`} name="kind" value={values.kind} onChange={(event) => setField("kind", event.target.value)} {...inputErrors(state, "kind", prefix)}><option value="TODO">Việc cần làm</option><option value="PREPARATION">Chuẩn bị cho ngày mai</option></select><FieldError state={state} name="kind" prefix={prefix} /></div>
      <div className="teacher-field"><label htmlFor={`${prefix}-details`}>Hướng dẫn thêm</label><textarea id={`${prefix}-details`} name="details" rows={4} maxLength={2000} value={values.details} onChange={(event) => setField("details", event.target.value)} placeholder="Ghi chú ngắn gọn để các em dễ thực hiện…" {...inputErrors(state, "details", prefix)} /><FieldError state={state} name="details" prefix={prefix} /></div>
      <div className="teacher-form-row"><div className="teacher-field"><label htmlFor={`${prefix}-date`}>Ngày thực hiện <span>(không bắt buộc)</span></label><input id={`${prefix}-date`} name="task_date" type="date" value={values.task_date} onChange={(event) => setField("task_date", event.target.value)} {...inputErrors(state, "task_date", prefix)} /><FieldError state={state} name="task_date" prefix={prefix} /></div><div className="teacher-field"><label htmlFor={`${prefix}-sort`}>Thứ tự hiển thị</label><input id={`${prefix}-sort`} name="sort_order" type="number" min={0} max={10000} step={1} required value={values.sort_order} onChange={(event) => setField("sort_order", event.target.value)} {...inputErrors(state, "sort_order", prefix)} /><FieldError state={state} name="sort_order" prefix={prefix} /></div></div>
      <p className="teacher-field-help">Để trống ngày nếu việc này lặp lại hằng ngày. Công việc chỉ hiển thị trong lớp, không đăng lên trang chủ.</p>
      <Feedback state={state} /><button className="button button-primary full-width teacher-submit" type="submit">{pending ? "Đang lưu công việc…" : task ? "Lưu thay đổi công việc" : "Lưu việc cần làm"}</button>
    </fieldset>
  </form>;
}

export function ArchiveContentForm({ type, id, title }: { type: "post" | "event" | "task"; id: string; title: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(archiveContentAction, emptyState);
  return <details className="teacher-archive-details"><summary>Lưu trữ nội dung</summary><form action={action} className="teacher-archive-form" aria-busy={pending}>
    <input type="hidden" name="type" value={type} /><input type="hidden" name="id" value={id} />
    <p>Nội dung sẽ ngừng hiển thị với người đọc và vẫn được lưu lại.</p>
    <label className="teacher-checkbox"><input name="confirmed" type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={pending} /> Tôi xác nhận lưu trữ “{title}”.</label>
    <Feedback state={state} /><button className="button button-danger button-small" type="submit" disabled={pending || !confirmed}>{pending ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}</button>
  </form></details>;
}
