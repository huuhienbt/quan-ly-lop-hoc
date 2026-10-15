import "server-only";

import { cache } from "react";
import { batch, query } from "@/lib/d1";
import {
  siteThemeSchema,
  siteThemeUpdateSchema,
  type SiteTheme,
  type SiteThemeSettings,
  type SiteThemeUpdate,
} from "@/lib/theme-schemas";

export type { SiteTheme, SiteThemeSettings } from "@/lib/theme-schemas";

export class SiteThemeActionError extends Error {
  constructor(
    public readonly kind: "invalid" | "unavailable" | "forbidden" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "SiteThemeActionError";
  }
}

const verifiedAdmin = `EXISTS (
  SELECT 1 FROM users actor WHERE actor.id = ? AND actor.role = 'SUPER_ADMIN'
    AND actor.status = 'ACTIVE' AND actor.email_verified_at IS NOT NULL
)`;

// Strict reads are used by the editor: a missing migration or failed D1 request
// must never be presented as a saved setting.
export async function getSiteThemeSettings(): Promise<SiteThemeSettings> {
  const rows = await query<SiteThemeSettings>(
    `SELECT site_theme AS theme, revision, updated_by, updated_at
     FROM site_settings WHERE id = 'site'`,
  );
  const row = rows[0];
  if (!row || !siteThemeSchema.safeParse(row.theme).success ||
    !Number.isSafeInteger(row.revision) || row.revision < 1 ||
    typeof row.updated_at !== "string" || Number.isNaN(Date.parse(row.updated_at)) ||
    (row.updated_by !== null && typeof row.updated_by !== "string")) {
    throw new SiteThemeActionError("unavailable", "Chưa thể đọc cấu hình giao diện. Hãy thử lại sau.");
  }
  return row;
}

// React cache deduplicates this within one server render, without keeping an old
// theme across requests. An unavailable database keeps the public site usable.
export const getSiteTheme = cache(async (): Promise<SiteTheme> => {
  try {
    return (await getSiteThemeSettings()).theme;
  } catch {
    return "playful";
  }
});

export async function updateSiteTheme(
  actorId: string,
  input: SiteThemeUpdate,
): Promise<SiteThemeSettings> {
  const parsed = siteThemeUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new SiteThemeActionError("invalid", "Lựa chọn giao diện không hợp lệ. Hãy tải lại trang.");
  }
  const { theme, revision } = parsed.data;
  if (typeof actorId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(actorId)) {
    throw new SiteThemeActionError("forbidden", "Bạn không có quyền thay đổi giao diện website.");
  }
  const now = new Date().toISOString();
  const results = await batch([
    {
      sql: `UPDATE site_settings SET site_theme = ?, revision = revision + 1,
          updated_by = ?, updated_at = ?
        WHERE id = 'site' AND revision = ? AND ${verifiedAdmin}`,
      params: [theme, actorId, now, revision, actorId],
    },
    {
      sql: `INSERT INTO audit_logs
          (id, actor_user_id, action, entity_type, entity_id, details_json)
        SELECT ?, ?, 'SITE_THEME_UPDATED', 'site_settings', 'site', ?
        WHERE changes() > 0 AND ${verifiedAdmin}`,
      params: [crypto.randomUUID(), actorId, JSON.stringify({ theme, revision: revision + 1 }), actorId],
    },
  ]);
  if (!results[0]?.meta.changes) {
    const actors = await query<{ id: string }>(
      `SELECT id FROM users WHERE id = ? AND role = 'SUPER_ADMIN'
        AND status = 'ACTIVE' AND email_verified_at IS NOT NULL`, [actorId],
    );
    if (!actors[0]) {
      throw new SiteThemeActionError("forbidden", "Bạn không có quyền thay đổi giao diện website.");
    }
    throw new SiteThemeActionError("conflict", "Cấu hình giao diện đã thay đổi ở một cửa sổ khác. Hãy tải lại trang rồi chọn lại.");
  }
  // Return the revision written by this action. A concurrent later write must
  // not turn an acknowledged save into an uncertain extra read or replay.
  return { theme, revision: revision + 1, updated_by: actorId, updated_at: now };
}
