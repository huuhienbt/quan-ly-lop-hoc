"use client";

import { useState } from "react";
import type { TeacherStudentRow } from "@/lib/teacher-students";
import { StudentPasswordResetDialog, studentPasswordCandidates, type PasswordCandidate, type PasswordDialogMode } from "./teacher-student-bulk-reset";
import "./teacher-student-roster.css";

function accountLabel(student: TeacherStudentRow) {
  if (!student.account_id) return { text: "Chưa có tài khoản", className: "roster-status-neutral" };
  if (student.account_status === "SUSPENDED") return { text: "Tạm ngừng", className: "roster-status-off" };
  if (student.temporary_password_expired === 1) return { text: "Mật khẩu tạm hết hạn", className: "roster-status-off" };
  if (student.must_change_password === 1) return { text: "Cần đổi mật khẩu", className: "roster-status-wait" };
  return { text: "Đang hoạt động", className: "roster-status-active" };
}

const searchable = (value: string) => value.toLocaleLowerCase("vi").normalize("NFD")
  .replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();

export function TeacherStudentRoster({ classId, classroomName, schoolName, students }: {
  classId: string; classroomName: string; schoolName: string; students: TeacherStudentRow[];
}) {
  const [search, setSearch] = useState("");
  const [reset, setReset] = useState<{ candidates: PasswordCandidate[]; mode: PasswordDialogMode } | null>(null);
  const candidates = studentPasswordCandidates(students);
  const keyword = searchable(search);
  const phone = /^[+\d\s().-]+$/.test(search.trim()) ? search.trim().replace(/[\s().-]/g, "").replace(/^\+84/, "0") : "";
  const visible = keyword ? students.filter(student => searchable(student.full_name).includes(keyword)
    || (phone && student.phone?.includes(phone))) : students;

  return <section className="teacher-content-section student-roster" aria-labelledby="student-roster-title">
    <div className="teacher-section-heading">
      <div><h2 id="student-roster-title">Danh sách học sinh</h2><p>{classroomName} · {students.length} học sinh</p></div>
    </div>
    {students.length > 0 && <div className="roster-tools">
      <label className="roster-search">
        <span>Tìm học sinh</span>
        <input type="search" placeholder="Nhập họ tên hoặc số điện thoại" autoComplete="off" maxLength={100}
          value={search} onChange={event => setSearch(event.target.value)} />
      </label>
      {candidates.size > 0 && <button type="button" className="button button-primary roster-bulk-button"
        onClick={() => setReset({ candidates: [...candidates.values()], mode: "bulk" })}>Cấp lại hàng loạt</button>}
    </div>}
    {visible.length > 0 ? <div className="roster-board">
      <div className="roster-columns" aria-hidden="true"><span>Họ và tên</span><span>Số điện thoại đăng nhập</span><span>Tình trạng</span><span>Mật khẩu</span></div>
      <ul className="roster-list" aria-label={`Học sinh lớp ${classroomName}`} role="list">
        {visible.map(student => {
          const status = accountLabel(student);
          const candidate = student.can_reset === 1 && student.account_id ? candidates.get(student.account_id) : undefined;
          return <li className="roster-row" key={student.enrollment_id}>
            <div className="roster-name">
              {student.student_number != null && <span className="roster-number" aria-label={`Số thứ tự ${student.student_number}`}>{student.student_number}</span>}
              <strong>{student.full_name}</strong>
            </div>
            <span className="roster-phone"><span className="roster-mobile-label">Số đăng nhập: </span>{student.phone ?? "—"}</span>
            <span className={`roster-status ${status.className}`}>{status.text}</span>
            <div className="roster-action">
              {candidate ? <>
                <button type="button" className="button button-outline button-small"
                  aria-label={`Cấp lại mật khẩu cho ${student.full_name}`} onClick={() => setReset({ candidates: [candidate], mode: "single" })}>Cấp lại mật khẩu</button>
                <button type="button" className="button button-outline button-small"
                  aria-label={`Đặt mật khẩu cho ${student.full_name}`} onClick={() => setReset({ candidates: [candidate], mode: "manual" })}>Đặt mật khẩu</button>
              </> : student.account_status === "ACTIVE" ? <span className="roster-action-note">Tài khoản dùng ở nhiều lớp. Nhờ quản trị viên đổi mật khẩu.</span>
                : null}
            </div>
          </li>;
        })}
      </ul>
    </div> : <p className="roster-empty" role="status">{students.length ? "Không tìm thấy học sinh phù hợp." : "Lớp chưa có học sinh trong danh sách."}</p>}
    {reset && <StudentPasswordResetDialog classId={classId} classroomName={classroomName} schoolName={schoolName}
      candidates={reset.candidates} mode={reset.mode} onClose={() => setReset(null)} />}
  </section>;
}
