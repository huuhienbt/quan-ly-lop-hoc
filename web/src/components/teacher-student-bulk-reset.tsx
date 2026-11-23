"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { resetStudentPasswordsAction, type BulkResetStudentState } from "@/app/teacher/student-actions";
import { STUDENT_BULK_RESET_HOURS, STUDENT_BULK_RESET_LIMIT } from "@/lib/student-reset-options";
import type { BulkResetTarget, TeacherStudentRow } from "@/lib/teacher-students";

interface Candidate {
  target: BulkResetTarget;
  phone: string;
  names: string[];
}

const initial: BulkResetStudentState = { kind: "idle" };
const vietnamTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function BulkResetDialog({ classId, candidates, onClose }: { classId: string; candidates: Candidate[]; onClose: () => void }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [result, submitReset, pending] = useActionState(resetStudentPasswordsAction, initial);
  const [copied, setCopied] = useState("");
  const [clipboardError, setClipboardError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const infoId = useId();
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

  return <dialog className="roster-dialog roster-bulk-dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={infoId}
    onCancel={event => { if (pending) event.preventDefault(); }} onClose={onClose}>
    <h3 id={titleId} ref={heading} tabIndex={-1}>{result.kind === "success" ? "Đã cấp mật khẩu tạm" : "Cấp lại mật khẩu hàng loạt"}</h3>
    {result.kind === "success" ? <>
      <p id={infoId}><strong>{result.accounts.length} tài khoản</strong> · Hạn dùng: {vietnamTime.format(new Date(result.expiresAt))} (giờ Việt Nam).</p>
      <p>Gửi riêng mật khẩu cho từng phụ huynh. Danh sách mật khẩu chỉ hiển thị đến khi thầy cô đóng hộp thoại.</p>
      <ul className="roster-bulk-list" aria-label="Mật khẩu tạm theo số điện thoại" role="list">
        {result.accounts.map(entry => <li key={entry.phone} className="roster-bulk-receipt">
          <span className="roster-bulk-person"><strong>{entry.names.join(", ")}</strong><span>{entry.phone}</span></span>
          <code>{entry.temporaryPassword}</code>
          <button className="button button-outline button-small" type="button"
            aria-label={`Sao chép mật khẩu của ${entry.names.join(", ")}`}
            onClick={() => void copy(entry.phone, entry.temporaryPassword)}>{copied === entry.phone ? "Đã chép" : "Sao chép"}</button>
        </li>)}
      </ul>
      {(copied || clipboardError) && <p className="roster-copy-message" role="status">{clipboardError
        ? "Không thể sao chép tự động. Thầy cô có thể bôi đen mật khẩu và sao chép." : "Đã sao chép mật khẩu tạm."}</p>}
      <div className="roster-dialog-actions"><button type="button" className="button button-primary" onClick={() => dialog.current?.close()}>Xong</button></div>
    </> : <form action={submitReset} aria-busy={pending}>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="targets" value={JSON.stringify(targets)} />
      <input type="hidden" name="confirmed" value="yes" />
      <p id={infoId}>Chọn tài khoản cần cấp lại. Mỗi số điện thoại nhận một mật khẩu tạm 8 chữ số, dùng trong {STUDENT_BULK_RESET_HOURS} giờ và phải đổi khi đăng nhập.</p>
      <p>Mật khẩu và các phiên đăng nhập cũ của các tài khoản đã chọn sẽ hết hiệu lực. Các em dùng chung số điện thoại sẽ dùng chung mật khẩu tạm của tài khoản đó.</p>
      <div className="roster-bulk-select">
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
      </ul>
      {result.kind === "error" && <p className="roster-reset-error" role="alert">{result.message}</p>}
      <div className="roster-dialog-actions">
        <button type="button" className="button button-outline" disabled={pending} onClick={() => dialog.current?.close()}>Hủy</button>
        <button type="submit" className="button button-primary" disabled={pending || !targets.length}>
          {pending ? "Đang cấp lại…" : targets.length ? `Xác nhận cấp lại (${targets.length})` : "Xác nhận cấp lại"}
        </button>
      </div>
    </form>}
  </dialog>;
}

export function TeacherStudentBulkReset({ classId, students }: { classId: string; students: TeacherStudentRow[] }) {
  const [preview, setPreview] = useState<Candidate[] | null>(null);
  const byAccount = new Map<string, Candidate>();
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
  return <>
    <button type="button" className="button button-outline roster-bulk-button" disabled={!byAccount.size}
      onClick={() => setPreview([...byAccount.values()])}>Cấp lại hàng loạt</button>
    {preview && <BulkResetDialog classId={classId} candidates={preview} onClose={() => setPreview(null)} />}
  </>;
}
