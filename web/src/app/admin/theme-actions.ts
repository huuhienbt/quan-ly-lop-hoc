"use server";

import { revalidatePath } from "next/cache";
import { AuthorizationError, requireSuperAdmin } from "@/lib/rbac";
import { SiteThemeActionError, updateSiteTheme } from "@/lib/site-theme";
import { siteThemeFormSchema, siteThemes, type SiteThemeActionState } from "@/lib/theme-schemas";

export async function applySiteTheme(
  _previousState: SiteThemeActionState,
  formData: FormData,
): Promise<SiteThemeActionState> {
  let actor;
  try {
    actor = await requireSuperAdmin();
  } catch (error) {
    return {
      success: false,
      message: error instanceof AuthorizationError
        ? error.message : "Chưa thể xác minh quyền quản trị. Hãy thử lại sau.",
    };
  }
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) {
    return { success: false, message: "Biểu mẫu chứa trường bị lặp. Hãy tải lại trang và thử lại." };
  }
  const parsed = siteThemeFormSchema.safeParse(Object.fromEntries(entries));
  if (!parsed.success) {
    return { success: false, message: "Lựa chọn giao diện không hợp lệ. Hãy tải lại trang và chọn lại." };
  }
  try {
    await updateSiteTheme(actor.id, parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof SiteThemeActionError
        ? error.message : "Chưa thể lưu giao diện. Hãy kiểm tra kết nối và thử lại.",
    };
  }
  revalidatePath("/", "layout");
  const label = siteThemes.find((item) => item.id === parsed.data.theme)?.label;
  return { success: true, message: `Đã áp dụng ${label}. Đang tải lại website…` };
}
