"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { applySiteTheme } from "@/app/admin/theme-actions";
import { siteThemes, type SiteThemeActionState, type SiteThemeSettings, type SiteTheme } from "@/lib/theme-schemas";

const initialState: SiteThemeActionState = { success: false, message: "" };

export function SiteThemeForm({ settings }: { settings: SiteThemeSettings }) {
  const [state, action, pending] = useActionState(applySiteTheme, initialState);
  const [selected, setSelected] = useState<SiteTheme>(settings.theme);
  const reloading = useRef(false);

  useEffect(() => {
    if (state.success && !reloading.current) {
      reloading.current = true;
      // The root <html> theme is rendered on the server. Reload once only after
      // a confirmed save so every page receives the persisted global setting.
      window.location.reload();
    }
  }, [state.success]);

  return (
    <form action={action} className="site-theme-form" data-site-theme-form
      onReset={(event) => event.preventDefault()}>
      <input type="hidden" name="revision" value={settings.revision} />
      <fieldset disabled={pending || state.success}>
        <legend className="sr-only">Chọn giao diện cho toàn bộ website</legend>
        <div className="site-theme-options">
          {siteThemes.map((theme) => (
            <label className={`site-theme-option ${selected === theme.id ? "is-selected" : ""}`} key={theme.id}>
              <input type="radio" name="theme" value={theme.id} checked={selected === theme.id}
                onChange={() => setSelected(theme.id)} aria-describedby={`theme-${theme.id}-description`} />
              <span className={`site-theme-preview theme-preview-${theme.id}`}>
                <Image src={theme.preview} alt="" width={800} height={450} sizes="(max-width: 900px) 90vw, 30vw" />
                <span className="site-theme-option-label">{theme.label}</span>
                {settings.theme === theme.id && <span className="site-theme-current">Đang sử dụng</span>}
              </span>
              <span className="site-theme-option-body">
                <span className="site-theme-option-heading"><strong>{theme.name}</strong><span className="site-theme-check" aria-hidden="true">✓</span></span>
                <span className="site-theme-description" id={`theme-${theme.id}-description`}>{theme.description}</span>
                <span className="site-theme-colors" aria-hidden="true">{theme.colors.map((color) => <span style={{ background: color }} key={color} />)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="site-theme-form-bottom">
        <p className="field-help">Áp dụng cho toàn bộ website. Cả ba giao diện luôn được lưu để đổi lại; dữ liệu và tài khoản được giữ nguyên.</p>
        <button className="button button-primary" type="submit" disabled={pending || state.success}>{pending ? "Đang áp dụng…" : state.success ? "Đã lưu giao diện" : "Áp dụng giao diện"}</button>
      </div>
      {state.message && <p className={`form-message ${state.success ? "is-success" : "is-error"}`} role={state.success ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}
