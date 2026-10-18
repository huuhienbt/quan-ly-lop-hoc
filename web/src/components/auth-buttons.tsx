"use client";

import { signIn, signOut } from "next-auth/react";
import { useState } from "react";

export function GoogleSignInButton({ enabled, compact = false, callbackUrl = "/" }: { enabled: boolean; compact?: boolean; callbackUrl?: "/" | "/dang-nhap" }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function login() {
    setPending(true);
    setFailed(false);
    try { await signIn("google", { callbackUrl }); }
    catch { setPending(false); setFailed(true); }
  }

  return (
    <div className={compact ? "auth-button-wrap compact" : "auth-button-wrap"}>
      <button className={`button ${compact ? "button-outline" : "button-google"}`} onClick={login} disabled={!enabled || pending} type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.7 2.9-4.2 2.9-7.4Z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3a10 10 0 0 0 0 8.8l3.4-2.6Z" /><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.6l3.4 2.6A6 6 0 0 1 12 6.1Z" /></svg>
        {pending ? "Đang chuyển đến Google…" : compact ? "Đăng nhập" : "Đăng nhập bằng Google"}
      </button>
      {failed && <p className="form-message is-error" role="alert">Chưa thể đăng nhập. Vui lòng thử lại.</p>}
    </div>
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="auth-button-wrap compact">
      <button className="button button-quiet" disabled={pending} type="button" onClick={async () => {
        setPending(true); setFailed(false);
        try { await signOut({ callbackUrl: "/" }); }
        catch { setPending(false); setFailed(true); }
      }}>{pending ? "Đang đăng xuất…" : "Đăng xuất"}</button>
      {failed && <p className="form-message is-error" role="alert">Chưa thể đăng xuất. Hãy thử lại.</p>}
    </div>
  );
}
