import { z } from "zod";
import { addDays, vietnamToday } from "@/lib/content-schemas";

const identifier = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const timetableDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Ngày không tồn tại.");
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Giờ cần có định dạng HH:mm.");
export const timetableLessonSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  session: z.enum(["MORNING", "AFTERNOON"]),
  starts_at: time,
  ends_at: time,
  subject: z.string().trim().min(1, "Cần nhập tên môn học.").max(100),
  instructor: z.string().trim().max(100),
  todo: z.string().trim().max(1000),
  preparation: z.string().trim().max(1000),
}).strict().superRefine((lesson, context) => {
  if (lesson.starts_at >= lesson.ends_at) context.addIssue({ code: "custom", path: ["ends_at"], message: "Giờ kết thúc phải sau giờ bắt đầu." });
  if ((lesson.session === "MORNING" && lesson.ends_at > "12:00") ||
    (lesson.session === "AFTERNOON" && lesson.starts_at < "12:00")) {
    context.addIssue({ code: "custom", path: ["session"], message: "Giờ học cần phù hợp với buổi sáng hoặc buổi chiều." });
  }
});
export const timetableSchema = z.object({
  class_id: identifier,
  revision: z.union([z.number().int(), z.string().regex(/^(?:0|[1-9]\d*)$/).transform(Number)])
    .pipe(z.number().int().min(0).max(1_000_000)),
  effective_from: timetableDateSchema,
  lessons: z.array(timetableLessonSchema).max(64, "Thời khóa biểu có tối đa 64 tiết học."),
}).strict().superRefine((input, context) => {
  const sorted = input.lessons.map((lesson, index) => ({ ...lesson, index })).sort((a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at));
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1], current = sorted[index];
    if (previous.weekday === current.weekday && previous.ends_at > current.starts_at) {
      context.addIssue({ code: "custom", path: ["lessons", current.index, "starts_at"], message: "Các tiết trong cùng ngày không được trùng giờ." });
    }
  }
});
export const toggleTimetableCheckSchema = z.object({
  enrollment_id: identifier,
  lesson_id: identifier,
  kind: z.enum(["TODO", "PREPARATION"]),
  lesson_date: timetableDateSchema,
  completed: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]),
}).strict();
export type TimetableInput = z.output<typeof timetableSchema>;
export type TimetableLessonInput = z.output<typeof timetableLessonSchema>;
export type ToggleTimetableCheckInput = z.output<typeof toggleTimetableCheckSchema>;
export interface TeacherTimetable { revision: number; effective_from: string; lessons: TimetableLessonInput[] }
export interface TimetableSubjectPlan {
  lessonId: string;
  subject: string;
  todo: string;
  preparation: string;
  periods: Pick<TimetableLessonInput, "session" | "starts_at" | "ends_at" | "instructor">[];
  completed: boolean;
}
export interface StudentTimetablePlan {
  hasTimetable: boolean;
  effectiveFrom: string | null;
  today: string;
  preparationDate: string | null;
  todaySubjects: TimetableSubjectPlan[];
  preparationSubjects: TimetableSubjectPlan[];
}
export interface TimetablePlanRow extends TimetableLessonInput {
  id: string;
  lesson_date: string;
  effective_from: string;
  todo_completed: number;
  preparation_completed: number;
}
export function timetableWeekday(date: string): number {
  timetableDateSchema.parse(date);
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}
export function emptyTimetablePlan(today = vietnamToday()): StudentTimetablePlan {
  return { hasTimetable: false, effectiveFrom: null, today, preparationDate: null, todaySubjects: [], preparationSubjects: [] };
}
// The next teaching day may be Monday or the first day of a new effective version.
// Empty days and dates outside the class academic year are excluded by the query.
export function buildStudentTimetablePlan(rows: TimetablePlanRow[], today = vietnamToday()): StudentTimetablePlan {
  timetableDateSchema.parse(today);
  const ordered = [...rows].sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
  const nextDate = ordered.find((row) => row.lesson_date > today && row.lesson_date <= addDays(today, 14))?.lesson_date ?? null;
  function subjects(date: string | null, kind: "TODO" | "PREPARATION"): TimetableSubjectPlan[] {
    const grouped = new Map<string, TimetablePlanRow[]>();
    for (const row of ordered.filter((lesson) => lesson.lesson_date === date)) {
      const key = row.subject.normalize("NFC").toLocaleLowerCase("vi");
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return [...grouped.values()].map((lessons) => ({
      lessonId: lessons[0].id,
      subject: lessons[0].subject,
      todo: [...new Set(lessons.map((lesson) => lesson.todo).filter(Boolean))].join("\n") || `Ôn lại nội dung môn ${lessons[0].subject} đã học hôm nay.`,
      preparation: [...new Set(lessons.map((lesson) => lesson.preparation).filter(Boolean))].join("\n") || `Chuẩn bị sách, vở và đồ dùng môn ${lessons[0].subject} theo hướng dẫn của thầy cô.`,
      periods: lessons.map(({ session, starts_at, ends_at, instructor }) => ({ session, starts_at, ends_at, instructor })),
      completed: (kind === "TODO" ? lessons[0].todo_completed : lessons[0].preparation_completed) === 1,
    }));
  }
  return { hasTimetable: ordered.length > 0, effectiveFrom: ordered.find((row) => row.lesson_date === today)?.effective_from ?? ordered[0]?.effective_from ?? null,
    today, preparationDate: nextDate, todaySubjects: subjects(today, "TODO"), preparationSubjects: subjects(nextDate, "PREPARATION") };
}
