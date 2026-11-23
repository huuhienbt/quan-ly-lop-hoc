"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { resetStudentPasswordAction, type ResetStudentState } from "@/app/teacher/student-actions";
import type { TeacherStudentRow } from "@/lib/teacher-students";
import "./teacher-student-roster.css";

type ResetTarget = {
  enrollmentId: string;
  accountId: string;
  version: number;
  name: string;
  phone: string;
};

function resetTarget(student: TeacherStudentRow): ResetTarget | null {
  if (student.can_reset !== 1 || !student.account_id || !student.phone || !student.session_version) return null;
  return {
    enrollmentId: student.enrollment_id, accountId: student.account_id, version: student.session_version,
    name: student.full_name, phone: student.phone,
  };
}

function accountLabel(student: TeacherStudentRow) {
  if (!student.account_id) return { text: "Chưa có tài khoản", className: "roster-status-neutral" };
  if (student.account_status === "SUSPENDED") return { text: "Tạm ngừng", className: "roster-status-off" };
  if (student.must_change_password === 1) return { text: "Cần đổi mật khẩu", className: "roster-status-wait" };
  return { text: "Đang hoạt động", className: "roster-status-active" };
}

const searchable = (value: string) => value.toLocaleLowerCase("vi").normalize("NFD")
  .replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();
const initialReset: ResetStudentState = { kind: "idle" };

function PasswordResetDialog({ classId, student, onClose }: { classId: string; student: ResetTarget; onClose: () => void }) {
  const [result, formAction, pending] = useActionState(resetStudentPasswordAction, initialReset);
  const [copyMessage, setCopyMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = useId();
  const help = useId();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    if (result.kind === "success") heading.current?.focus();
  }, [result.kind]);

  async function copy(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopyMessage("Đã sao chép mật khẩu tạm.");
    } catch {
      setCopyMessage("Không thể sao chép tự động. Thầy cô có thể bôi đen mật khẩu và sao chép.");
    }
  }

  return <dialog className="roster-dialog" ref={dialog} aria-labelledby={title} aria-describedby={help}
    onClose={onClose} onCancel={event => { if (pending) event.preventDefault(); }}>
    <h3 id={title} ref={heading} tabIndex={-1}>{result.kind === "success" ? "Đã cấp mật khẩu tạm" : "Cấp lại mật khẩu tạm"}</h3>
    <p className="roster-dialog-account"><strong>{student.name}</strong><span>{student.phone}</span></p>
    {result.kind === "success" ? <>
      <p id={help}>Gửi mật khẩu tạm riêng cho phụ huynh. Học sinh sẽ phải đổi mật khẩu khi đăng nhập. Mật khẩu tạm chỉ hiện ở đây đến khi thầy cô đóng hộp thoại.</p>
      <div className="roster-password">
        <code aria-label="Mật khẩu tạm">{result.temporaryPassword}</code>
        <button className="button button-outline button-small" type="button" onClick={() => void copy(result.temporaryPassword)}>Sao chép</button>
      </div>
      {copyMessage && <p className="roster-copy-message" role="status">{copyMessage}</p>}
      <div className="roster-dialog-actions"><button className="button button-primary" type="button" onClick={() => dialog.current?.close()}>Xong</button></div>
    </> : <form action={formAction} aria-busy={pending}>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="enrollment_id" value={student.enrollmentId} />
      <input type="hidden" name="account_id" value={student.accountId} />
      <input type="hidden" name="session_version" value={student.version} />
      <input type="hidden" name="confirmed" value="yes" />
      <p id={help}>Mật khẩu cũ sẽ hết hiệu lực và các thiết bị đang dùng tài khoản này sẽ bị đăng xuất. Thay đổi áp dụng cho tất cả học sinh dùng chung số điện thoại trên.</p>
      {result.kind === "error" && <p className="roster-reset-error" role="alert">{result.message}</p>}
      <div className="roster-dialog-actions">
        <button type="button" className="button button-outline" disabled={pending} onClick={() => dialog.current?.close()}>Hủy</button>
        <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Đang cấp lại…" : "Xác nhận cấp lại"}</button>
      </div>
    </form>}
  </dialog>;
}

export function TeacherStudentRoster({ classId, classroomName, students }: { classId: string; classroomName: string; students: TeacherStudentRow[] }) {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<ResetTarget | null>(null);
  const keyword = searchable(search);
  const phone = /^[+\d\s().-]+$/.test(search.trim()) ? search.trim().replace(/[\s().-]/g, "").replace(/^\+84/, "0") : "";
  const visible = keyword ? students.filter(student => searchable(student.full_name).includes(keyword)
    || (phone && student.phone?.includes(phone))) : students;

  return <section className="teacher-content-section student-roster" aria-labelledby="student-roster-title">
    <div className="teacher-section-heading">
      <div><h2 id="student-roster-title">Danh sách học sinh</h2><p>{classroomName} · {students.length} học sinh</p></div>
      {students.length > 0 && <label className="roster-search">
        <span>Tìm học sinh</span>
        <input type="search" placeholder="Nhập họ tên hoặc số điện thoại" autoComplete="off" maxLength={100}
          value={search} onChange={event => setSearch(event.target.value)} />
      </label>}
    </div>
    {visible.length > 0 ? <div className="roster-board">
      <div className="roster-columns" aria-hidden="true"><span>Họ và tên</span><span>Số điện thoại đăng nhập</span><span>Tình trạng</span><span>Mật khẩu</span></div>
      <ul className="roster-list" aria-label={`Học sinh lớp ${classroomName}`} role="list">
        {visible.map(student => {
          const status = accountLabel(student);
          const reset = resetTarget(student);
          return <li className="roster-row" key={student.enrollment_id}>
            <div className="roster-name">
              {student.student_number != null && <span className="roster-number" aria-label={`Số thứ tự ${student.student_number}`}>{student.student_number}</span>}
              <strong>{student.full_name}</strong>
            </div>
            <span className="roster-phone"><span className="roster-mobile-label">Số đăng nhập: </span>{student.phone ?? "—"}</span>
            <span className={`roster-status ${status.className}`}>{status.text}</span>
            <div className="roster-action">
              {reset ? <button type="button" className="button button-outline button-small"
                aria-label={`Cấp lại mật khẩu cho ${student.full_name}`} onClick={() => setTarget(reset)}>Cấp lại mật khẩu</button>
                : student.account_status === "ACTIVE" ? <span className="roster-action-note">Tài khoản dùng ở nhiều lớp. Nhờ quản trị viên cấp lại.</span>
                : null}
            </div>
          </li>;
        })}
      </ul>
    </div> : <p className="roster-empty" role="status">{students.length ? "Không tìm thấy học sinh phù hợp." : "Lớp chưa có học sinh trong danh sách."}</p>}
    {target && <PasswordResetDialog classId={classId} student={target} onClose={() => setTarget(null)} />}
  </section>;
}
