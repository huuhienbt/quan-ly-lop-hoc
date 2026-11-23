"use client";

import { useState } from "react";
import { STUDENT_BULK_RESET_HOURS } from "@/lib/student-reset-options";
import type { TeacherStudentRow } from "@/lib/teacher-students";
import { StudentPasswordResetDialog, studentPasswordCandidates, type PasswordCandidate } from "./teacher-student-bulk-reset";
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
  const [panel, setPanel] = useState<"list" | "passwords">("list");
  const [search, setSearch] = useState("");
  const [reset, setReset] = useState<{ candidates: PasswordCandidate[]; single: boolean } | null>(null);
  const candidates = studentPasswordCandidates(students);
  const keyword = searchable(search);
  const phone = /^[+\d\s().-]+$/.test(search.trim()) ? search.trim().replace(/[\s().-]/g, "").replace(/^\+84/, "0") : "";
  const visible = keyword ? students.filter(student => searchable(student.full_name).includes(keyword)
    || (phone && student.phone?.includes(phone))) : students;

  return <section className="teacher-content-section student-roster" aria-labelledby="student-roster-title">
    <div className="teacher-section-heading">
      <div><h2 id="student-roster-title">Danh sách học sinh</h2><p>{classroomName} · {students.length} học sinh</p></div>
    </div>
    <div className="roster-view-switch" role="group" aria-label="Quản lý học sinh">
      <button className="button button-outline" type="button" aria-pressed={panel === "list"} onClick={() => setPanel("list")}>Danh sách</button>
      <button className="button button-outline" type="button" aria-pressed={panel === "passwords"} onClick={() => setPanel("passwords")}>Mật khẩu học sinh</button>
    </div>
    {panel === "passwords" ? <section className="roster-password-workspace" aria-label="Mật khẩu học sinh và phiếu đăng nhập">
      <div className="roster-password-card">
        <span className="roster-workspace-tag">{candidates.size} tài khoản có thể cấp lại</span>
        <h3>Cấp lại mật khẩu</h3>
        <p>Chọn một hoặc nhiều tài khoản để tạo mật khẩu tạm 8 chữ số, có hiệu lực {STUDENT_BULK_RESET_HOURS} giờ.</p>
        <button type="button" className="button button-primary roster-bulk-button" disabled={!candidates.size}
          onClick={() => setReset({ candidates: [...candidates.values()], single: false })}>Cấp lại hàng loạt</button>
      </div>
      <div className="roster-password-card">
        <span className="roster-workspace-tag">Ảnh PNG · Một phiếu mỗi tài khoản</span>
        <h3>Xuất phiếu gửi phụ huynh</h3>
        <p>Sau khi cấp mật khẩu, bấm <strong>Xuất phiếu</strong> bên cạnh số điện thoại cần gửi. Phiếu có thông tin đăng nhập, hạn dùng và hướng dẫn cho phụ huynh.</p>
      </div>
    </section> : <>
      {students.length > 0 && <div className="roster-tools">
        <label className="roster-search">
          <span>Tìm học sinh</span>
          <input type="search" placeholder="Nhập họ tên hoặc số điện thoại" autoComplete="off" maxLength={100}
            value={search} onChange={event => setSearch(event.target.value)} />
        </label>
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
                {candidate ? <button type="button" className="button button-outline button-small"
                  aria-label={`Cấp lại mật khẩu cho ${student.full_name}`} onClick={() => setReset({ candidates: [candidate], single: true })}>Cấp lại mật khẩu</button>
                  : student.account_status === "ACTIVE" ? <span className="roster-action-note">Tài khoản dùng ở nhiều lớp. Nhờ quản trị viên cấp lại.</span>
                  : null}
              </div>
            </li>;
          })}
        </ul>
      </div> : <p className="roster-empty" role="status">{students.length ? "Không tìm thấy học sinh phù hợp." : "Lớp chưa có học sinh trong danh sách."}</p>}
    </>}
    {reset && <StudentPasswordResetDialog classId={classId} classroomName={classroomName} schoolName={schoolName}
      candidates={reset.candidates} single={reset.single} onClose={() => setReset(null)} />}
  </section>;
}
