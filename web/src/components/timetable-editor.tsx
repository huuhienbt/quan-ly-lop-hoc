"use client";

import { useActionState, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTimetableAction } from "@/app/teacher/timetable-actions";
import type { TeacherTimetable, TimetableLessonInput } from "@/lib/timetable-schemas";
import "./timetable-editor.css";

const dayLabels = ["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];
const sessions = [{ value: "MORNING", label: "Buổi sáng", start: "07:20", end: "07:55" }, { value: "AFTERNOON", label: "Buổi chiều", start: "13:40", end: "14:15" }] as const;
type LessonRow = TimetableLessonInput & { localKey: string };
type SaveState = Awaited<ReturnType<typeof saveTimetableAction>>;
const initialState: SaveState = { success: false, message: "" };

function lessonRows(lessons: TimetableLessonInput[]): LessonRow[] {
  return lessons.map((lesson, index) => ({ ...lesson, localKey: `saved-${index}` }));
}

function afterMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function TimetableEditor({ classId, timetable }: { classId: string; timetable: TeacherTimetable }) {
  return <TimetableEditorForm key={`${classId}-${timetable.revision}`} classId={classId} timetable={timetable} />;
}

function TimetableEditorForm({ classId, timetable }: { classId: string; timetable: TeacherTimetable }) {
  const prefix = useId();
  const router = useRouter();
  const [day, setDay] = useState(1);
  const [lessons, setLessons] = useState(() => lessonRows(timetable.lessons));
  const [effectiveFrom, setEffectiveFrom] = useState(timetable.effective_from);
  const [awaitingRefresh, setAwaitingRefresh] = useState(false);
  const [state, action, pending] = useActionState(async (previous: SaveState, formData: FormData): Promise<SaveState> => {
    const invalid = lessons.find((lesson) => !lesson.subject.trim() || !lesson.starts_at || !lesson.ends_at || lesson.starts_at >= lesson.ends_at || (lesson.session === "MORNING" ? lesson.ends_at > "12:00" : lesson.starts_at < "12:00"));
    if (invalid) {
      setDay(invalid.weekday);
      return { success: false, message: `Vui lòng kiểm tra tên môn và giờ học ${dayLabels[invalid.weekday - 1]}. Giờ kết thúc cần sau giờ bắt đầu; buổi sáng kết thúc trước 12 giờ và buổi chiều bắt đầu từ 12 giờ.` };
    }
    const sorted = [...lessons].sort((a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at));
    const overlap = sorted.find((lesson, index) => index > 0 && sorted[index - 1].weekday === lesson.weekday && sorted[index - 1].ends_at > lesson.starts_at);
    if (overlap) {
      setDay(overlap.weekday);
      return { success: false, message: `Một số khung giờ ${dayLabels[overlap.weekday - 1]} đang trùng nhau. Thầy cô kiểm tra lại trước khi lưu nhé.` };
    }
    const result = await saveTimetableAction(previous, formData);
    if (result.success) {
      setAwaitingRefresh(true);
      router.refresh();
    }
    return result;
  }, initialState);
  const busy = pending || awaitingRefresh;
  const serializedLessons = lessons.map(({ weekday, session, starts_at, ends_at, subject, instructor, todo, preparation }) => ({ weekday, session, starts_at, ends_at, subject, instructor, todo, preparation }));

  function updateLesson(key: string, field: keyof TimetableLessonInput, value: string) {
    setLessons((current) => current.map((lesson) => lesson.localKey === key ? { ...lesson, [field]: value } : lesson));
  }

  function addLesson(session: typeof sessions[number]) {
    const rows = lessons.filter((lesson) => lesson.weekday === day && lesson.session === session.value);
    if (lessons.length >= 64) return;
    const previousEnd = rows.length ? rows[rows.length - 1].ends_at : session.start;
    setLessons((current) => [...current, { localKey: crypto.randomUUID(), weekday: day, session: session.value, starts_at: previousEnd, ends_at: afterMinutes(previousEnd, 35), subject: "", instructor: "", todo: "", preparation: "" }]);
  }

  return <form className="timetable-editor" action={action} onReset={(event) => event.preventDefault()} aria-busy={busy} data-timetable-editor>
    <input type="hidden" name="class_id" value={classId} />
    <input type="hidden" name="revision" value={timetable.revision} />
    <input type="hidden" name="effective_from" value={effectiveFrom} />
    <input type="hidden" name="lessons" value={JSON.stringify(serializedLessons)} />
    <fieldset disabled={busy}>
      <legend className="sr-only">Thời khóa biểu của lớp</legend>
      <div className="timetable-editor-intro"><strong>Một lịch học, hai lời nhắc mỗi ngày</strong><p>Các môn hôm nay hiện trong “Hôm nay em làm gì?”. Sách vở cho buổi học tiếp theo hiện trong “Chiếc cặp ngày mai”. Thầy cô có thể chỉnh lời nhắc cho từng môn bên dưới.</p></div>
      <label className="timetable-effective-date" htmlFor={`${prefix}-date`}><span>Áp dụng từ ngày</span><input id={`${prefix}-date`} type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} aria-invalid={!!state.fieldErrors?.effective_from} aria-describedby={state.fieldErrors?.effective_from?.length ? `${prefix}-date-error` : undefined} /></label>
      {!!state.fieldErrors?.effective_from?.length && <p className="timetable-editor-error" id={`${prefix}-date-error`}>{state.fieldErrors.effective_from.join(" ")}</p>}
      <div className="timetable-day-buttons" role="group" aria-label="Chọn ngày để chỉnh thời khóa biểu">{dayLabels.map((label, index) => <button key={label} type="button" aria-pressed={day === index + 1} className={day === index + 1 ? "is-active" : ""} onClick={() => setDay(index + 1)}><span>{label}</span><span className="timetable-day-count">{lessons.filter((lesson) => lesson.weekday === index + 1).length} mục</span></button>)}</div>
      <div className="timetable-selected-heading"><h4>{dayLabels[day - 1]}</h4><span>Không thêm lịch vào các buổi nghỉ.</span></div>
      <div className="timetable-session-grid">{sessions.map((session) => {
        const rows = lessons.filter((lesson) => lesson.weekday === day && lesson.session === session.value);
        return <section className={`timetable-session timetable-session-${session.value.toLowerCase()}`} key={session.value} aria-labelledby={`${prefix}-${session.value}-title`}>
          <div className="timetable-session-heading"><h5 id={`${prefix}-${session.value}-title`}>{session.label}</h5><span>{rows.length} mục</span></div>
          {!rows.length && <p className="timetable-empty-session">Chưa có tiết học trong buổi này.</p>}
          <div className="timetable-editor-lessons">{rows.map((lesson, index) => {
            const rowId = `${prefix}-${lesson.localKey}`;
            return <article className="timetable-lesson-editor" key={lesson.localKey}>
              <div className="timetable-lesson-editor-title"><strong>Khung giờ {index + 1}</strong><button type="button" className="timetable-remove-lesson" aria-label={`Bỏ lịch ${lesson.subject || index + 1}, ${session.label}, ${dayLabels[day - 1]}`} onClick={() => setLessons((current) => current.filter((item) => item.localKey !== lesson.localKey))}>Bỏ lịch</button></div>
              <label className="timetable-field" htmlFor={`${rowId}-subject`}><span>Môn học / hoạt động</span><input id={`${rowId}-subject`} required maxLength={100} value={lesson.subject} onChange={(event) => updateLesson(lesson.localKey, "subject", event.target.value)} placeholder="Ví dụ: Tiếng Việt" /></label>
              <div className="timetable-time-fields"><label className="timetable-field" htmlFor={`${rowId}-start`}><span>Bắt đầu</span><input id={`${rowId}-start`} type="time" step={60} required value={lesson.starts_at} onChange={(event) => updateLesson(lesson.localKey, "starts_at", event.target.value)} /></label><label className="timetable-field" htmlFor={`${rowId}-end`}><span>Kết thúc</span><input id={`${rowId}-end`} type="time" step={60} required value={lesson.ends_at} onChange={(event) => updateLesson(lesson.localKey, "ends_at", event.target.value)} /></label></div>
              <label className="timetable-field" htmlFor={`${rowId}-instructor`}><span>Giáo viên <small>(không bắt buộc)</small></span><input id={`${rowId}-instructor`} maxLength={100} value={lesson.instructor} onChange={(event) => updateLesson(lesson.localKey, "instructor", event.target.value)} placeholder="Tên thầy / cô phụ trách" /></label>
              <details className="timetable-lesson-notes"><summary>Lời nhắc ôn lại và chuẩn bị{(lesson.todo || lesson.preparation) && <span aria-hidden="true"> · Đã có</span>}</summary><label className="timetable-field" htmlFor={`${rowId}-todo`}><span>Việc cần hoàn thành sau buổi học</span><textarea id={`${rowId}-todo`} rows={3} maxLength={1000} value={lesson.todo} onChange={(event) => updateLesson(lesson.localKey, "todo", event.target.value)} placeholder="Lời nhắc ôn lại môn học…" /></label><label className="timetable-field" htmlFor={`${rowId}-preparation`}><span>Sách vở, đồ dùng cần chuẩn bị trước buổi học</span><textarea id={`${rowId}-preparation`} rows={3} maxLength={1000} value={lesson.preparation} onChange={(event) => updateLesson(lesson.localKey, "preparation", event.target.value)} placeholder="Ví dụ: sách, vở và đồ dùng của môn học…" /></label></details>
            </article>;
          })}</div>
          <button type="button" className="timetable-add-lesson" disabled={lessons.length >= 64} onClick={() => addLesson(session)}>+ Thêm lịch {session.label.toLocaleLowerCase("vi")}</button>
        </section>;
      })}</div>
      {!!state.fieldErrors?.lessons?.length && <p className="timetable-editor-error">{state.fieldErrors.lessons.join(" ")}</p>}
      {state.message && <p className={`timetable-editor-feedback${state.success ? " is-success" : " is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p>}
      <div className="timetable-editor-footer"><p>{lessons.length} mục lịch trong tuần · Nhấn lưu để cập nhật cho học sinh.</p><button className="button button-primary" type="submit">{busy ? "Đang lưu thời khóa biểu…" : "Lưu thời khóa biểu"}</button></div>
    </fieldset>
  </form>;
}
