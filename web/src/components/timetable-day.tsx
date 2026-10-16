"use client";

import { useActionState, useId, useRef } from "react";
import { updateTimetableCheck } from "@/app/hoc-sinh/timetable-actions";
import type { StudentTimetablePlan, TimetableSubjectPlan } from "@/lib/timetable-schemas";
import "./timetable-day.css";

type CheckKind = "TODO" | "PREPARATION";
type CheckState = Awaited<ReturnType<typeof updateTimetableCheck>>;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${value}T12:00:00+07:00`));
}

function nextCalendarDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function SubjectChecklistRow({ subject, enrollmentId, date, kind }: { subject: TimetableSubjectPlan; enrollmentId: string; date: string; kind: CheckKind }) {
  const inputId = useId();
  const form = useRef<HTMLFormElement>(null);
  const initialState: CheckState = { success: false, message: "", completed: subject.completed };
  const [state, action, pending] = useActionState(updateTimetableCheck, initialState);
  const note = kind === "TODO" ? subject.todo : subject.preparation;

  return <li className={`timetable-subject${state.completed ? " is-complete" : ""}`}>
    <form ref={form} action={action} onReset={(event) => event.preventDefault()} aria-busy={pending} className="timetable-subject-form">
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <input type="hidden" name="lesson_id" value={subject.lessonId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="lesson_date" value={date} />
      <input type="hidden" name="completed" value={String(!state.completed)} />
      <input type="checkbox" id={inputId} checked={state.completed} disabled={pending} onChange={() => form.current?.requestSubmit()} aria-describedby={`${inputId}-status${state.message ? ` ${inputId}-feedback` : ""}`} className="timetable-subject-checkbox" />
      <label htmlFor={inputId} className="timetable-subject-label"><strong>{subject.subject}</strong><span className="timetable-periods">{subject.periods.map((period, index) => <span className="timetable-period" key={`${period.session}-${period.starts_at}-${index}`}><span>{period.session === "MORNING" ? "Sáng" : "Chiều"} · {period.starts_at}–{period.ends_at}</span>{period.instructor && <span className="timetable-period-instructor">{period.instructor}</span>}</span>)}</span>{note && <span className="timetable-subject-note">{note}</span>}<span className="timetable-subject-status" id={`${inputId}-status`}>{pending ? "Đang lưu…" : state.completed ? kind === "TODO" ? "Em đã hoàn thành" : "Em đã chuẩn bị xong" : kind === "TODO" ? "Đánh dấu khi em đã hoàn thành" : "Đánh dấu khi em đã chuẩn bị"}</span></label>
    </form>
    {state.message && <p className={`timetable-check-feedback${state.success ? " is-success" : ""}`} id={`${inputId}-feedback`} role={state.success ? "status" : "alert"}>{state.message}</p>}
  </li>;
}

export function TimetableToday({ plan, enrollmentId }: { plan: StudentTimetablePlan; enrollmentId: string }) {
  if (!plan.hasTimetable) return <p className="timetable-day-empty">Thầy cô chưa cập nhật thời khóa biểu cho lớp mình.</p>;
  if (plan.effectiveFrom && plan.effectiveFrom > plan.today) return <p className="timetable-day-empty">Thời khóa biểu của lớp bắt đầu từ {dateLabel(plan.effectiveFrom)}.</p>;
  if (!plan.todaySubjects.length) return <p className="timetable-day-empty">Hôm nay không có tiết học theo thời khóa biểu. Em có thể nghỉ ngơi và xem các lời nhắc của thầy cô nhé.</p>;
  return <div className="timetable-day timetable-today" data-timetable-today><div className="timetable-day-caption"><strong>Các môn hôm nay</strong><p>Ôn lại bài học và thực hiện lời nhắc theo lịch của lớp.</p></div><ul className="timetable-subject-list">{plan.todaySubjects.map((subject) => <SubjectChecklistRow key={`${plan.today}-TODO-${subject.lessonId}`} subject={subject} enrollmentId={enrollmentId} date={plan.today} kind="TODO" />)}</ul><p className="timetable-day-footnote">Đây là lời nhắc ôn lại theo lịch học. Bài tập cụ thể sẽ được thầy cô giao thêm.</p></div>;
}

export function TimetablePreparation({ plan, enrollmentId }: { plan: StudentTimetablePlan; enrollmentId: string }) {
  if (!plan.hasTimetable) return <p className="timetable-day-empty">Khi thầy cô cập nhật thời khóa biểu, sách vở và đồ dùng cần chuẩn bị sẽ hiện tại đây.</p>;
  if (!plan.preparationDate || !plan.preparationSubjects.length) return <p className="timetable-day-empty">Chưa có buổi học tiếp theo trong thời khóa biểu. Em theo dõi thông báo của thầy cô nhé.</p>;
  const isTomorrow = plan.preparationDate === nextCalendarDay(plan.today);
  return <div className="timetable-day timetable-preparation" data-timetable-preparation><div className="timetable-day-caption"><strong>{isTomorrow ? "Chuẩn bị cho ngày mai" : "Chuẩn bị cho buổi học tiếp theo"}</strong><p><time dateTime={plan.preparationDate}>{dateLabel(plan.preparationDate)}</time></p>{!isTomorrow && <p>Ngày mai không có tiết học theo thời khóa biểu. Em chuẩn bị cho buổi học kế tiếp nhé.</p>}</div><ul className="timetable-subject-list">{plan.preparationSubjects.map((subject) => <SubjectChecklistRow key={`${plan.preparationDate}-PREPARATION-${subject.lessonId}`} subject={subject} enrollmentId={enrollmentId} date={plan.preparationDate!} kind="PREPARATION" />)}</ul><p className="timetable-day-footnote">Nhớ kiểm tra bút, thước và bình nước trước khi đi học nhé.</p></div>;
}
