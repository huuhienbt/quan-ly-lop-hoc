"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { updateStudentPassword, type StudentPasswordState } from "@/app/hoc-sinh/doi-mat-khau/actions";
import { classHomeLinks, studentAccountLink, type StudentHomeDestination, type StudentHomeSection } from "@/lib/student-home";
import { STUDENT_PASSWORD_HELP, STUDENT_PASSWORD_MAX_LENGTH, STUDENT_PASSWORD_MIN_LENGTH } from "@/lib/student-reset-options";
import { ArrowIcon } from "./icons";

export function StudentLoginForm({ enabled, destination = classHomeLinks["tin-lop"] }: { enabled: boolean; destination?: StudentHomeDestination }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await signIn("student", { phone, password, redirect: false, callbackUrl: destination });
      if (response?.ok && !response.error) {
        window.location.replace(destination);
        return;
      }
      setError("Số điện thoại hoặc mật khẩu chưa đúng. Em hãy kiểm tra lại nhé.");
    } catch {
      setError("Chưa thể đăng nhập lúc này. Em hãy thử lại sau nhé.");
    }
    setPassword("");
    setPending(false);
  }

  return (
    <form method="post" onSubmit={login} className="student-form" aria-busy={pending}>
      <fieldset disabled={!enabled || pending}>
        <legend className="sr-only">Tài khoản học sinh</legend>
        <div className="student-field"><label htmlFor="student-phone">Số điện thoại</label><input id="student-phone" name="phone" type="tel" inputMode="tel" autoComplete="username" required maxLength={20} placeholder="Nhập số điện thoại đã đăng ký" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
        <div className="student-field"><label htmlFor="student-password">Mật khẩu</label><input id="student-password" name="password" type="password" autoComplete="current-password" required maxLength={STUDENT_PASSWORD_MAX_LENGTH} placeholder="Nhập mật khẩu của em" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        {error && <p className="form-message is-error" role="alert">{error}</p>}
        <button className="button button-primary full-width student-submit" type="submit">{pending ? "Đang đăng nhập…" : <>Vào góc học sinh <ArrowIcon /></>}</button>
      </fieldset>
    </form>
  );
}

const initialPasswordState: StudentPasswordState = { success: false, message: "" };

export function StudentPasswordForm({ forced = false, next = "tin-lop" }: { forced?: boolean; next?: StudentHomeSection }) {
  const [passwords, setPasswords] = useState<Record<string, string>>({ current_password: "", new_password: "", confirm_password: "" });
  const [state, action, pending] = useActionState(updateStudentPassword, initialPasswordState);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const loginAgain = next === "tin-lop" ? "/dang-nhap?changed=1" : `/dang-nhap?changed=1&tiep=${next}`;

  async function finishPasswordChange() {
    try { await signOut({ callbackUrl: loginAgain }); }
    catch { setSignOutFailed(true); }
  }

  useEffect(() => {
    if (state.success) {
      signOut({ callbackUrl: loginAgain }).catch(() => setSignOutFailed(true));
    }
  }, [state.success, loginAgain]);

  if (state.success) return <div className="student-password-success"><p className="form-message is-success" role="status">{state.message}</p>{signOutFailed && <button className="button button-primary full-width" type="button" onClick={finishPasswordChange}>Đăng nhập lại</button>}</div>;

  const fields = [
    { name: "current_password", id: "student-current-password", label: "Mật khẩu hiện tại", autocomplete: "current-password", min: 1 },
    { name: "new_password", id: "student-new-password", label: "Mật khẩu mới", autocomplete: "new-password", min: STUDENT_PASSWORD_MIN_LENGTH },
    { name: "confirm_password", id: "student-confirm-password", label: "Nhập lại mật khẩu mới", autocomplete: "new-password", min: STUDENT_PASSWORD_MIN_LENGTH },
  ];

  return <form action={action} className="student-form" aria-busy={pending}>
    <fieldset disabled={pending}><legend className="sr-only">Đổi mật khẩu học sinh</legend>
      {fields.map((field) => <div className="student-field" key={field.name}><label htmlFor={field.id}>{field.label}</label><input type="password" id={field.id} name={field.name} autoComplete={field.autocomplete} required minLength={field.min} value={passwords[field.name]} onChange={(event) => setPasswords((previous) => ({ ...previous, [field.name]: event.target.value }))} aria-invalid={!!state.fieldErrors?.[field.name]} aria-describedby={[state.fieldErrors?.[field.name]?.length ? `${field.id}-error` : "", field.name === "new_password" ? "student-password-help" : ""].filter(Boolean).join(" ") || undefined} />{state.fieldErrors?.[field.name]?.length ? <p className="field-error" id={`${field.id}-error`}>{state.fieldErrors[field.name].join(" ")}</p> : null}{field.name === "new_password" && <p className="student-field-help" id="student-password-help">{STUDENT_PASSWORD_HELP} Em có thể dùng một cụm từ dễ nhớ, khác mật khẩu hiện tại.</p>}</div>)}
      {state.message && <p className="form-message is-error" role="alert">{state.message}</p>}
      <button className="button button-primary full-width student-submit" type="submit">{pending ? "Đang đổi mật khẩu…" : "Lưu mật khẩu mới"}</button>
    </fieldset>
    {!forced && <Link className="student-relogin-link" href={studentAccountLink}>Về trang tài khoản</Link>}
  </form>;
}
