import { z } from "zod";

export const siteThemeSchema = z.enum(["playful", "discovery", "harmony"]);
export type SiteTheme = z.output<typeof siteThemeSchema>;

// A successful compare-and-swap increments this number once.
const revisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1);

export const siteThemeUpdateSchema = z.object({
  theme: siteThemeSchema,
  revision: revisionSchema,
}).strict();

// FormData is text. Do not silently coerce empty values, fractions or booleans.
export const siteThemeFormSchema = z.object({
  theme: siteThemeSchema,
  revision: z.string().regex(/^[1-9]\d{0,15}$/).transform(Number).pipe(revisionSchema),
}).strict();

export type SiteThemeUpdate = z.output<typeof siteThemeUpdateSchema>;

export interface SiteThemeSettings {
  theme: SiteTheme;
  revision: number;
  updated_by: string | null;
  updated_at: string;
}

export interface SiteThemeActionState {
  success: boolean;
  message: string;
}

export const siteThemes: ReadonlyArray<{
  id: SiteTheme;
  label: string;
  name: string;
  description: string;
  preview: string;
  colors: readonly [string, string, string];
}> = [
  {
    id: "playful",
    label: "Giao diện 1",
    name: "Lớp học vui nhộn",
    description: "Xanh dương rực rỡ, vàng nắng và nhân vật hoạt hình 3D đáng yêu.",
    preview: "/images/happy-school-3d.webp",
    colors: ["#078bd4", "#ffd440", "#ff8dbb"],
  },
  {
    id: "discovery",
    label: "Giao diện 2",
    name: "Thế giới khám phá",
    description: "Xanh trời, xanh ngọc và thế giới cổ tích; đăng nhập gọn, lối vào nhanh và thư viện ảnh của lớp.",
    preview: "/images/theme-2-current.webp",
    colors: ["#a6def5", "#30aa91", "#ffd34f"],
  },
  {
    id: "harmony",
    label: "Giao diện 3",
    name: "Lớp học khám phá hạnh phúc",
    description: "Đầu trang gọn, tin lớp dễ tìm; kết hợp sắc màu vui tươi và thế giới khám phá.",
    preview: "/images/discovery-hero-3d.webp",
    colors: ["#219b8a", "#175d9b", "#ffda53"],
  },
];
