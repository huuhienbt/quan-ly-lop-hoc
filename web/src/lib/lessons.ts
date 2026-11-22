import { z } from "zod";

export const MAX_LESSON_PDF = 3 * 1024 * 1024;
export const MAX_LESSON_IMAGE = 3 * 1024 * 1024;
export const lessonAssetId = z.uuid();
export const lessonAssetUrl = (id: string) => `/api/lesson-assets/${id}`;

export function httpsLessonUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch { return null; }
}

type MediaKind = "image" | "pdf" | "video" | "audio";
export type LessonMedia = { src: string; open: string; player: "native" | "youtube" | "drive" | "pdf" };

export function resolveLessonMedia(type: MediaKind, raw: string): LessonMedia | null {
  const url = httpsLessonUrl(raw);
  if (!url) return null;
  const original = url.href;
  const host = url.hostname.toLowerCase();
  if (type === "video" || type === "audio") {
    const youtube = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host);
    const id = host === "youtu.be" ? url.pathname.split("/")[1]
      : youtube ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1] : null;
    if (id && /^[\w-]{11}$/.test(id)) return {
      src: `https://www.youtube-nocookie.com/embed/${id}`, open: `https://www.youtube.com/watch?v=${id}`, player: "youtube",
    };
  }
  if (host === "drive.google.com" && type !== "image") {
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]
      ?? (url.pathname === "/open" ? url.searchParams.get("id") : null);
    if (!id || !/^[\w-]{1,180}$/.test(id)) return null;
    const key = url.searchParams.get("resourcekey");
    const suffix = key ? `?resourcekey=${encodeURIComponent(key)}` : "";
    return { src: `https://drive.google.com/file/d/${id}/preview${suffix}`, open: `https://drive.google.com/file/d/${id}/view${suffix}`, player: "drive" };
  }
  if (host === "github.com") {
    const file = url.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/blob\/(.+)$/);
    if (file) url.href = `https://raw.githubusercontent.com/${file[1]}/${file[2]}/${file[3]}`;
  }
  if (type === "video" && !/\.(mp4|webm|ogv|m4v)$/i.test(url.pathname)) return null;
  if (type === "audio" && !/\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(url.pathname)) return null;
  return { src: url.href, open: type === "video" || type === "audio" ? original : url.href, player: type === "pdf" ? "pdf" : "native" };
}

const href = z.string().trim().min(1).max(2048).refine((value) => !!httpsLessonUrl(value), "Cần dùng đường dẫn HTTPS hợp lệ.");
const caption = z.string().trim().max(180);
export const lessonWidths = ["25", "40", "60", "80", "100"] as const;
export const lessonColors = ["#263b50", "#9b2625", "#8a460d", "#14695a", "#164e9f", "#663b8f"] as const;
const width = z.enum(lessonWidths);
const marks = z.object({ bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(), color: z.enum(lessonColors).optional() }).strict();
const richRun = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), value: z.string().min(1).max(8000), marks: marks.optional() }).strict(),
  z.object({ kind: z.literal("fraction"), numerator: z.string().min(1).max(32), denominator: z.string().min(1).max(32), marks: marks.optional() }).strict(),
  z.object({ kind: z.literal("blank"), marks: marks.optional() }).strict(),
]);
export type LessonRun = z.infer<typeof richRun>;
export type LessonMarks = z.infer<typeof marks>;
export function runsPlainText(runs: LessonRun[]) {
  return runs.map((run) => run.kind === "text" ? run.value : run.kind === "fraction" ? `${run.numerator}/${run.denominator}` : "________").join("");
}
export const lessonKinds = { NEWS: "Bài học", ANNOUNCEMENT: "Thông báo học tập", ACTIVITY: "Hoạt động học tập" } as const;
export function lessonDateLabel(iso: string) {
  const utc = new Date(`${iso}T00:00:00Z`);
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const week = Math.ceil(((+thursday - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `Ngày ${iso.split("-").reverse().join("/")} · Tuần ${week}`;
}
const source = z.object({ url: href.optional(), assetId: lessonAssetId.optional() });
const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(8000), align: z.enum(["left", "center", "right"]), rich: z.array(richRun).max(240).optional() }).strict(),
  z.object({ type: z.literal("link"), label: caption.min(1), url: href }).strict(),
  source.extend({ type: z.literal("image"), label: caption, width }).strict(),
  source.extend({ type: z.literal("pdf"), label: caption }).strict(),
  z.object({ type: z.literal("video"), label: caption, url: href }).strict(),
  z.object({ type: z.literal("audio"), label: caption, url: href }).strict(),
]);

export const lessonBlocksSchema = z.array(block).min(1).max(24).superRefine((items, context) => {
  items.forEach((item, index) => {
    if (item.type === "text" && !item.text.trim()) context.addIssue({ code: "custom", path: [index], message: "Khối văn bản đang trống." });
    if (item.type === "text" && item.rich && runsPlainText(item.rich) !== item.text) context.addIssue({ code: "custom", path: [index], message: "Nội dung văn bản không khớp." });
    if (item.type === "image" || item.type === "pdf") {
      if (Boolean(item.url) === Boolean(item.assetId)) context.addIssue({ code: "custom", path: [index], message: "Chọn tệp hoặc nhập một đường dẫn." });
    }
    if (item.type !== "text" && item.type !== "link" && item.url && !resolveLessonMedia(item.type, item.url)) {
      context.addIssue({ code: "custom", path: [index], message: "Đường dẫn không phù hợp với loại nội dung." });
    }
  });
});

export type LessonBlock = z.infer<typeof block>;

export function decodeLesson(raw: string | null | undefined): LessonBlock[] | null {
  if (!raw || raw.length > 48000) return null;
  try {
    const result = lessonBlocksSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

export type LessonInline =
  | { kind: "plain"; value: string }
  | { kind: "bold" | "italic" | "underline"; children: LessonInline[] }
  | { kind: "fraction"; numerator: string; denominator: string };

export function lessonInline(text: string, depth = 0): LessonInline[] {
  if (depth >= 5) return [{ kind: "plain", value: text }];
  const parts: LessonInline[] = [];
  const pattern = /\[\[frac:([^|\]\n]{1,32})\|([^|\]\n]{1,32})\]\]|\*\*([^\n]+?)\*\*(?!\*)|__([^\n]+?)__|\*([^*\n]+?)\*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > cursor) parts.push({ kind: "plain", value: text.slice(cursor, start) });
    if (match[1]) parts.push({ kind: "fraction", numerator: match[1], denominator: match[2] });
    else if (match[3]) parts.push({ kind: "bold", children: lessonInline(match[3], depth + 1) });
    else if (match[4]) parts.push({ kind: "underline", children: lessonInline(match[4], depth + 1) });
    else parts.push({ kind: "italic", children: lessonInline(match[5], depth + 1) });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: "plain", value: text.slice(cursor) });
  return parts;
}

export function lessonSummary(blocks: LessonBlock[]) {
  function plain(nodes: LessonInline[]): string {
    return nodes.map((node) => node.kind === "plain" ? node.value
      : node.kind === "fraction" ? `${node.numerator}/${node.denominator}` : plain(node.children)).join("");
  }
  return blocks.filter((block) => block.type === "text" || block.label)
    .map((block) => block.type === "text" ? block.rich ? block.text : plain(lessonInline(block.text)) : block.label)
    .join("\n").trim().slice(0, 20000) || "Bài học có tài liệu đính kèm.";
}
