import { z } from "zod";

const id = z.string().trim().min(1, "Thiếu mã định danh.").max(100, "Mã định danh quá dài.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Mã định danh không hợp lệ.");
const title = z.string().trim().min(1, "Vui lòng nhập tiêu đề.").max(200, "Tiêu đề không quá 200 ký tự.");
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày cần có định dạng YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Ngày không tồn tại.");

export const postCategories = ["GENERAL", "CLASS_STORY", "KINDNESS", "PARENT_GUIDE", "DISCOVERY"] as const;
export type PostCategory = typeof postCategories[number];
export type ContentVisibility = "PUBLIC" | "PRIVATE";
export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const managedPostImagePattern = /^\/api\/post-images\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const postSchema = z.object({
  id: id.optional(),
  class_id: id,
  title,
  body: z.string().trim().min(1, "Vui lòng nhập nội dung.").max(20_000, "Nội dung không quá 20.000 ký tự."),
  kind: z.enum(["NEWS", "ANNOUNCEMENT", "ACTIVITY"]),
  category: z.enum(postCategories),
  cover_url: z.union([
    z.literal(""),
    z.string().regex(managedPostImagePattern, "Ảnh đã tải lên không hợp lệ."),
    z.string().trim().max(2048, "Đường dẫn ảnh quá dài.").url("Đường dẫn ảnh không hợp lệ.")
      .refine((value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Ảnh bìa cần dùng đường dẫn HTTPS không chứa thông tin đăng nhập."),
  ]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  visibility: z.enum(["PRIVATE", "PUBLIC"]),
  is_pinned: z.union([z.boolean(), z.literal("on")]).optional().transform((value) => value === true || value === "on"),
}).strict();

export const eventSchema = z.object({
  id: id.optional(),
  class_id: id,
  title,
  body: z.string().trim().max(4000, "Nội dung không quá 4.000 ký tự."),
  event_date: calendarDate,
  starts_at: z.union([z.literal(""), z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Giờ cần có định dạng HH:MM.")]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  visibility: z.enum(["PRIVATE", "PUBLIC"]),
}).strict();

export const taskSchema = z.object({
  id: id.optional(),
  class_id: id,
  title,
  details: z.string().trim().max(2000, "Chi tiết không quá 2.000 ký tự."),
  kind: z.enum(["TODO", "PREPARATION"]),
  task_date: z.union([z.literal(""), calendarDate, z.null()]).optional(),
  sort_order: z.coerce.number().int("Thứ tự phải là số nguyên.").min(0, "Thứ tự không được âm.").max(10_000, "Thứ tự quá lớn."),
}).strict();

export const archiveContentSchema = z.object({ type: z.enum(["post", "event", "task"]), id }).strict();
export const toggleTaskSchema = z.object({
  task_id: id,
  enrollment_id: id,
  completed: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]),
}).strict();

export type PostInput = z.output<typeof postSchema>;
export type EventInput = z.output<typeof eventSchema>;
export type TaskInput = z.output<typeof taskSchema>;
export type ArchiveContentInput = z.output<typeof archiveContentSchema>;
export type ToggleTaskInput = z.output<typeof toggleTaskSchema>;

export interface ContentClass { id: string; name: string; slug: string; school_id: string; school_name: string }
interface ClassContentFields { id: string; class_id: string; class_name: string; class_slug: string; title: string; created_at: string; updated_at: string }
export interface ContentPost extends ClassContentFields {
  body: string;
  kind: "NEWS" | "ANNOUNCEMENT" | "ACTIVITY";
  category: PostCategory;
  cover_url: string | null;
  status: PublicationStatus;
  visibility: ContentVisibility;
  is_pinned: number;
  published_at: string | null;
}
export interface ClassEvent extends ClassContentFields {
  body: string;
  event_date: string;
  starts_at: string | null;
  visibility: ContentVisibility;
  status: PublicationStatus;
}
export interface ClassTask extends ClassContentFields {
  details: string;
  kind: "TODO" | "PREPARATION";
  task_date: string | null;
  sort_order: number;
  status: "PUBLISHED" | "ARCHIVED";
}
export interface StudentTask extends ClassTask { completed: boolean }
export interface StudentClassSpace {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  class_slug: string;
  school_name: string;
  posts: ContentPost[];
  events: ClassEvent[];
  tasks: StudentTask[];
}
export interface VietnamDateWindow { today: string; tomorrow: string; weekStart: string; weekEnd: string }
export interface PublicBulletin extends VietnamDateWindow { posts: ContentPost[]; events: ClassEvent[] }
export interface StudentClassContent extends VietnamDateWindow { students: StudentClassSpace[] }
export interface TeacherContentOverview extends VietnamDateWindow { classes: ContentClass[]; posts: ContentPost[]; events: ClassEvent[]; tasks: ClassTask[] }

export function vietnamToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addDays(isoDate: string, days: number): string {
  if (!calendarDate.safeParse(isoDate).success || !Number.isSafeInteger(days)) throw new Error("Ngày không hợp lệ.");
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getVietnamDateWindow(now = new Date()): VietnamDateWindow {
  const today = vietnamToday(now);
  const mondayOffset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -mondayOffset);
  return { today, tomorrow: addDays(today, 1), weekStart, weekEnd: addDays(weekStart, 6) };
}
