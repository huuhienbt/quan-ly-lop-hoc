"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { resetStudentPasswordsAction, setStudentPasswordAction, type BulkResetStudentState } from "@/app/teacher/student-actions";
import { downloadParentLoginSlip, formatLoginSlipExpiry } from "@/lib/parent-login-slip";
import { STUDENT_BULK_RESET_HOURS, STUDENT_BULK_RESET_LIMIT } from "@/lib/student-reset-options";
import type { BulkResetEntry, BulkResetTarget, TeacherStudentRow } from "@/lib/teacher-students";

export interface PasswordCandidate {
  target: BulkResetTarget;
  phone: string;
  names: string[];
}
export type PasswordDialogMode = "bulk" | "single" | "manual";

const initial: BulkResetStudentState = { kind: "idle" };

export function StudentPasswordResetDialog({ classId, classroomName, schoolName, candidates, mode, onClose }: {
  classId: string;
  classroomName: string;
  schoolName: string;
  candidates: PasswordCandidate[];
  mode: PasswordDialogMode;
  onClose: () => void;
}) {
  const single = mode !== "bulk";
  const manual = mode === "manual";
  const singleAccount = single ? candidates[0] : undefined;
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(singleAccount ? [singleAccount.target.account_id] : []));
  const [result, submitReset, pending] = useActionState(manual ? setStudentPasswordAction : resetStudentPasswordsAction, initial);
  const [showPin, setShowPin] = useState(false);
  const [copied, setCopied] = useState("");
  const [clipboardError, setClipboardError] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const infoId = useId();
  const pinId = useId();
  const pinHelpId = useId();
  const targets = candidates.filter(candidate => selected.has(candidate.target.account_id)).map(candidate => candidate.target);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      heading.current?.focus();
    }
  }, []);
  useEffect(() => {
    if (result.kind === "success") heading.current?.focus();
  }, [result.kind]);

  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous);
      if (!next.delete(id) && next.size < STUDENT_BULK_RESET_LIMIT) next.add(id);
      return next;
    });
  }

  async function copy(phone: string, password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(phone);
      setClipboardError(false);
    } catch {
      setCopied("");
      setClipboardError(true);
    }
  }

  async function exportSlip(entry: BulkResetEntry, expiresAt: string) {
    if (exporting) return;
    setExporting(entry.phone);
    setExportMessage("");
    try {
      await downloadParentLoginSlip({ ...entry, classroomName, schoolName, expiresAt });
      setExportMessage(`Đã tạo phiếu cho số điện thoại có đuôi ${entry.phone.slice(-4)}. Xem trong mục tệp tải xuống.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Chưa tạo được phiếu. Thầy cô hãy thử lại.");
    } finally {
      setExporting(null);
    }
  }

  return <dialog className="roster-dialog roster-bulk-dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={infoId}
    onCancel={event => { if (pending || exporting) event.preventDefault(); }} onClose={onClose}>
    <h3 id={titleId} ref={heading} tabIndex={-1}>{result.kind === "success" ? "Phiếu gửi phụ huynh"
      : manual ? "Đặt mật khẩu học sinh" : single ? "Cấp lại mật khẩu học sinh" : "Cấp lại mật khẩu hàng loạt"}</h3>
    {result.kind === "success" ? <>
      <p id={infoId}>Đã cấp mật khẩu tạm cho <strong>{result.accounts.length} tài khoản</strong>. Hạn dùng: {formatLoginSlipExpiry(result.expiresAt)} (giờ Việt Nam).</p>
      <p>Bấm <strong>Xuất phiếu</strong> ở từng dòng để tải ảnh PNG và gửi riêng cho phụ huynh. Tải các phiếu cần dùng trước khi bấm <strong>Xong</strong>.</p>
      <ul className="roster-bulk-list" aria-label="Mật khẩu tạm theo số điện thoại" role="list">
        {result.accounts.map(entry => <li key={entry.phone} className="roster-bulk-receipt">
          <span className="roster-bulk-person"><strong>{entry.names.join(", ")}</strong><span>{entry.phone}</span></span>
          <code>{entry.temporaryPassword}</code>
          <div className="roster-slip-actions">
            <button className="button button-primary button-small" type="button" disabled={!!exporting}
              aria-label={`Xuất phiếu PNG cho ${entry.names.join(", ")}`}
              onClick={() => void exportSlip(entry, result.expiresAt)}>{exporting === entry.phone ? "Đang tạo…" : "Xuất phiếu"}</button>
            <button className="button button-outline button-small" type="button"
              aria-label={`Sao chép mật khẩu của ${entry.names.join(", ")}`}
              onClick={() => void copy(entry.phone, entry.temporaryPassword)}>{copied === entry.phone ? "Đã chép" : "Sao chép mã"}</button>
          </div>
        </li>)}
      </ul>
      {(copied || clipboardError) && <p className="roster-copy-message" role="status">{clipboardError
        ? "Không thể sao chép tự động. Thầy cô có thể bôi đen mật khẩu và sao chép." : "Đã sao chép mật khẩu tạm."}</p>}
      {exportMessage && <p className="roster-copy-message" role="status">{exportMessage}</p>}
      <div className="roster-dialog-actions"><button type="button" className="button button-outline" disabled={!!exporting} onClick={() => dialog.current?.close()}>Xong</button></div>
    </> : <form action={submitReset} aria-busy={pending}>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="confirmed" value="yes" />
      {manual && singleAccount ? <>
        <input type="hidden" name="enrollment_id" value={singleAccount.target.enrollment_id} />
        <input type="hidden" name="account_id" value={singleAccount.target.account_id} />
        <input type="hidden" name="session_version" value={singleAccount.target.session_version} />
      </> : <input type="hidden" name="targets" value={JSON.stringify(targets)} />}
      {singleAccount && <p className="roster-dialog-account"><strong>{singleAccount.names.join(", ")}</strong><span>{singleAccount.phone}</span></p>}
      <p id={infoId}>{manual ? "Mật khẩu tạm" : single ? "Cấp một mật khẩu tạm" : "Mỗi số điện thoại nhận một mật khẩu tạm"} 8 chữ số, dùng trong {STUDENT_BULK_RESET_HOURS} giờ. Học sinh phải đổi mật khẩu khi đăng nhập.</p>
      {manual && <div className="roster-manual-pin">
        <label htmlFor={pinId}>Mật khẩu tạm mới</label>
        <div>
          <input id={pinId} name="temporary_password" type={showPin ? "text" : "password"} inputMode="numeric"
            pattern="[0-9]{8}" minLength={8} maxLength={8} required readOnly={pending} autoComplete="new-password"
            spellCheck={false} aria-describedby={pinHelpId} />
          <button className="button button-outline button-small" type="button" aria-controls={pinId}
            aria-label={showPin ? "Ẩn mật khẩu tạm" : "Hiện mật khẩu tạm"}
            disabled={pending} onClick={() => setShowPin(value => !value)}>{showPin ? "Ẩn" : "Hiện"}</button>
        </div>
        <span id={pinHelpId}>Nhập đúng 8 chữ số. Tránh dùng ngày sinh, số điện thoại hoặc dãy số dễ đoán.</span>
      </div>}
      <p>Mật khẩu cũ và các phiên đăng nhập của {single ? "tài khoản này" : "các tài khoản đã chọn"} sẽ hết hiệu lực.
        {(!single || (singleAccount && singleAccount.names.length > 1)) && " Các em dùng chung số điện thoại sẽ dùng chung mật khẩu tạm của tài khoản đó."}</p>
      {!single && <><div className="roster-bulk-select">
        <span role="status">Đã chọn <strong>{targets.length}/{candidates.length}</strong> tài khoản</span>
        <button type="button" className="button button-outline button-small" disabled={pending || targets.length >= Math.min(candidates.length, STUDENT_BULK_RESET_LIMIT)}
          onClick={() => setSelected(new Set(candidates.slice(0, STUDENT_BULK_RESET_LIMIT).map(candidate => candidate.target.account_id)))}>
          {candidates.length <= STUDENT_BULK_RESET_LIMIT ? "Chọn tất cả" : `Chọn ${STUDENT_BULK_RESET_LIMIT} tài khoản đầu`}
        </button>
        <button type="button" className="button button-quiet button-small" disabled={pending || !targets.length} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
      </div>
      {candidates.length > STUDENT_BULK_RESET_LIMIT && <p className="roster-copy-message">Mỗi lượt chọn tối đa {STUDENT_BULK_RESET_LIMIT} tài khoản.</p>}
      <ul className="roster-bulk-list" aria-label="Chọn tài khoản cần cấp lại mật khẩu" role="list">
        {candidates.map(candidate => {
          const id = candidate.target.account_id;
          const checked = selected.has(id);
          return <li key={id}><label className="roster-bulk-option">
            <input type="checkbox" checked={checked} onChange={() => toggle(id)}
              disabled={pending || (!checked && targets.length >= STUDENT_BULK_RESET_LIMIT)} />
            <span className="roster-bulk-person"><strong>{candidate.names.join(", ")}</strong><span>{candidate.phone}</span></span>
          </label></li>;
        })}
      </ul></>}
      {result.kind === "error" && <p className="roster-reset-error" role="alert">{result.message}</p>}
      <div className="roster-dialog-actions">
        <button type="button" className="button button-outline" disabled={pending} onClick={() => dialog.current?.close()}>Hủy</button>
        <button type="submit" className="button button-primary" disabled={pending || !targets.length}>
          {manual ? (pending ? "Đang lưu…" : "Lưu mật khẩu") : pending ? "Đang cấp lại…"
            : targets.length && !single ? `Xác nhận cấp lại (${targets.length})` : "Xác nhận cấp lại"}
        </button>
      </div>
    </form>}
  </dialog>;
}

export function studentPasswordCandidates(students: TeacherStudentRow[]) {
  const byAccount = new Map<string, PasswordCandidate>();
  for (const row of students) {
    if (row.can_reset !== 1 || !row.account_id || !row.phone || !row.session_version) continue;
    const existing = byAccount.get(row.account_id);
    if (existing) existing.names.push(row.full_name);
    else byAccount.set(row.account_id, {
      target: { account_id: row.account_id, enrollment_id: row.enrollment_id, session_version: row.session_version },
      phone: row.phone,
      names: [row.full_name],
    });
  }
  return byAccount;
}
