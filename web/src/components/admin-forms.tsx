"use client";

import { useActionState } from "react";
import {
  approveTeacherRequest,
  rejectTeacherRequest,
  createAcademicYear,
  createClass,
  assignTeacher,
  endTeacherAssignment,
  setUserStatus,
} from "@/app/admin/actions";
import type { ActionState, AcademicYear, AdminClass, Teacher } from "@/lib/admin";

const initialState: ActionState = { success: false, message: "" };

function Feedback({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={`form-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p>;
}

function FieldError({ state, name, id }: { state: ActionState; name: string; id: string }) {
  const errors = state.fieldErrors?.[name];
  return errors?.length ? <p id={id} className="field-error">{errors.join(" ")}</p> : null;
}

export function TeacherReviewForms({ requestId, name }: { requestId: string; name: string }) {
  const [approved, approve, approving] = useActionState(approveTeacherRequest, initialState);
  const [rejected, reject, rejecting] = useActionState(rejectTeacherRequest, initialState);
  return (
    <div className="request-actions">
      <form action={approve}>
        <input type="hidden" name="request_id" value={requestId} />
        <button className="button button-primary button-small" disabled={approving || rejecting} type="submit" aria-label={`Duyệt ${name} thành giáo viên`}>{approving ? "Đang duyệt…" : "Duyệt giáo viên"}</button>
        <Feedback state={approved} />
      </form>
      <form action={reject}>
        <input type="hidden" name="request_id" value={requestId} />
        <button className="button button-outline button-small" disabled={approving || rejecting} type="submit" aria-label={`Từ chối yêu cầu của ${name}`}>{rejecting ? "Đang xử lý…" : "Từ chối"}</button>
        <Feedback state={rejected} />
      </form>
    </div>
  );
}

export function AcademicYearForm() {
  const [state, action, pending] = useActionState(createAcademicYear, initialState);
  return (
    <form action={action} className="form-stack">
      <div className="field">
        <label htmlFor="year-name">Tên năm học</label>
        <input id="year-name" name="name" required maxLength={100} placeholder="Ví dụ: 2026–2027" aria-invalid={!!state.fieldErrors?.name} aria-describedby="year-name-error" />
        <FieldError state={state} name="name" id="year-name-error" />
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="year-start">Ngày bắt đầu</label>
          <input id="year-start" name="starts_on" type="date" required aria-invalid={!!state.fieldErrors?.starts_on} aria-describedby="year-start-error" />
          <FieldError state={state} name="starts_on" id="year-start-error" />
        </div>
        <div className="field">
          <label htmlFor="year-end">Ngày kết thúc</label>
          <input id="year-end" name="ends_on" type="date" required aria-invalid={!!state.fieldErrors?.ends_on} aria-describedby="year-end-error" />
          <FieldError state={state} name="ends_on" id="year-end-error" />
        </div>
      </div>
      <label className="checkbox-field"><input type="checkbox" name="is_current" /> Đặt làm năm học hiện tại</label>
      <p className="field-help">Nếu được chọn, năm học này sẽ thay thế năm học hiện tại của trường.</p>
      <Feedback state={state} />
      <button className="button button-primary full-width form-submit" type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Tạo năm học"}</button>
    </form>
  );
}

export function CreateClassForm({ years }: { years: AcademicYear[] }) {
  const [state, action, pending] = useActionState(createClass, initialState);
  if (!years.length) return <p className="panel-top-note">Hãy tạo năm học trước để bắt đầu thêm lớp.</p>;
  const defaultYear = years.find((year) => year.is_current === 1)?.id ?? years[0].id;
  return (
    <form action={action} className="form-stack">
      <div className="form-row">
        <div className="field">
          <label htmlFor="class-name">Tên lớp</label>
          <input id="class-name" name="name" required maxLength={100} placeholder="Ví dụ: Bốn 12" aria-invalid={!!state.fieldErrors?.name} aria-describedby="class-name-error" />
          <FieldError state={state} name="name" id="class-name-error" />
        </div>
        <div className="field">
          <label htmlFor="class-grade">Khối</label>
          <select id="class-grade" name="grade" defaultValue="4" required aria-invalid={!!state.fieldErrors?.grade} aria-describedby="class-grade-error">
            {[1, 2, 3, 4, 5].map((grade) => <option key={grade} value={grade}>Khối {grade}</option>)}
          </select>
          <FieldError state={state} name="grade" id="class-grade-error" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="class-year">Năm học</label>
        <select id="class-year" name="academic_year_id" defaultValue={defaultYear} required aria-invalid={!!state.fieldErrors?.academic_year_id} aria-describedby="class-year-error">
          {years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " · Hiện tại" : ""}</option>)}
        </select>
        <FieldError state={state} name="academic_year_id" id="class-year-error" />
      </div>
      <div className="field">
        <label htmlFor="class-slug">Mã đường dẫn của lớp</label>
        <input id="class-slug" name="slug" required minLength={3} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="bon-12-2026-2027" spellCheck={false} autoCapitalize="none" aria-invalid={!!state.fieldErrors?.slug} aria-describedby="class-slug-help class-slug-error" />
        <p className="field-help" id="class-slug-help">Dùng chữ thường không dấu, số và dấu gạch nối. Thêm năm học để tránh trùng lớp.</p>
        <FieldError state={state} name="slug" id="class-slug-error" />
      </div>
      <div className="field">
        <label htmlFor="class-greeting">Lời chào <span className="field-help">(không bắt buộc)</span></label>
        <textarea id="class-greeting" name="greeting" maxLength={1000} placeholder="Chào mừng các em đến với lớp Bốn 12!" aria-invalid={!!state.fieldErrors?.greeting} aria-describedby="class-greeting-error" />
        <FieldError state={state} name="greeting" id="class-greeting-error" />
      </div>
      <p className="field-help">Lớp mới được tạo ở chế độ riêng tư.</p>
      <Feedback state={state} />
      <button className="button button-primary full-width form-submit" type="submit" disabled={pending}>{pending ? "Đang tạo lớp…" : "Tạo lớp học"}</button>
    </form>
  );
}

export function AssignTeacherForm({ classes, teachers }: { classes: AdminClass[]; teachers: Teacher[] }) {
  const [state, action, pending] = useActionState(assignTeacher, initialState);
  if (!classes.length || !teachers.length) return <p className="panel-top-note">{!classes.length ? "Tạo lớp học để bắt đầu phân công giáo viên chủ nhiệm." : "Duyệt ít nhất một giáo viên trước khi phân công chủ nhiệm."}</p>;
  return (
    <form action={action} className="form-stack">
      <div className="field">
        <label htmlFor="assignment-class">Lớp học</label>
        <select id="assignment-class" name="class_id" required defaultValue="" aria-invalid={!!state.fieldErrors?.class_id} aria-describedby="assignment-class-error">
          <option disabled value="">Chọn lớp cần phân công</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}{item.teacher_name ? " · Đã có GVCN" : ""}</option>)}
        </select>
        <FieldError state={state} name="class_id" id="assignment-class-error" />
      </div>
      <div className="field">
        <label htmlFor="assignment-teacher">Giáo viên đã được duyệt</label>
        <select id="assignment-teacher" name="user_id" required defaultValue="" aria-invalid={!!state.fieldErrors?.user_id} aria-describedby="assignment-teacher-error">
          <option disabled value="">Chọn giáo viên chủ nhiệm</option>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.email}</option>)}
        </select>
        <FieldError state={state} name="user_id" id="assignment-teacher-error" />
      </div>
      <p className="field-help">Mỗi lớp có một GVCN. Phân công mới sẽ kết thúc phân công cũ của lớp nếu có.</p>
      <Feedback state={state} />
      <button className="button button-primary full-width form-submit" disabled={pending} type="submit">{pending ? "Đang phân công…" : "Phân công chủ nhiệm"}</button>
    </form>
  );
}

export function EndAssignmentForm({ classId, teacherId, className }: { classId: string; teacherId: string; className: string }) {
  const [state, action, pending] = useActionState(endTeacherAssignment, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="user_id" value={teacherId} />
      <button className="button button-quiet button-small" type="submit" disabled={pending} aria-label={`Kết thúc phân công giáo viên của lớp ${className}`}>{pending ? "Đang cập nhật…" : "Kết thúc phân công"}</button>
      <Feedback state={state} />
    </form>
  );
}

export function UserStatusForm({ userId, name, status }: { userId: string; name: string; status: "ACTIVE" | "SUSPENDED" }) {
  const [state, action, pending] = useActionState(setUserStatus, initialState);
  const nextStatus = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  return (
    <form action={action}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="status" value={nextStatus} />
      <button className={`button button-small ${status === "ACTIVE" ? "button-danger" : "button-outline"}`} type="submit" disabled={pending} aria-label={`${status === "ACTIVE" ? "Tạm ngừng tài khoản" : "Mở lại tài khoản"} ${name}`}>
        {pending ? "Đang cập nhật…" : status === "ACTIVE" ? "Tạm ngừng" : "Mở lại tài khoản"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
