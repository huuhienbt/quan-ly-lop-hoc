"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/rbac";
import { decodeLesson } from "@/lib/lessons";
import { saveLearningPost } from "@/lib/lesson-posts";
import type { ContentActionState } from "./actions";
import { postDateSchema, vietnamToday } from "@/lib/content-schemas";

const rowId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const schema = z.object({
  id: rowId.optional(),
  class_id: rowId,
  title: z.string().trim().min(1).max(200),
  document: z.string().min(2).max(48000),
  kind: z.enum(["NEWS", "ANNOUNCEMENT", "ACTIVITY"]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  post_date: postDateSchema.optional(),
}).strict();

export async function saveLearningPostAction(_previous: ContentActionState, form: FormData): Promise<ContentActionState> {
  try {
    const actor = await getCurrentUser();
    if (!actor || !["TEACHER", "SUPER_ADMIN"].includes(actor.role)) return { success: false, message: "Thầy cô chưa có quyền đăng bài học." };
    const entries = [...form.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
    const parsed = schema.safeParse(Object.fromEntries(entries));
    if (entries.length !== new Set(entries.map(([key]) => key)).size || !parsed.success || !decodeLesson(parsed.data.document)) {
      return { success: false, message: "Vui lòng nhập tiêu đề và kiểm tra văn bản, tệp hoặc đường dẫn trong bài." };
    }
    if (parsed.data.post_date && parsed.data.post_date > vietnamToday()) {
      return { success: false, message: "Ngày đăng không được sau ngày hôm nay." };
    }
    if (!await saveLearningPost(actor.id, parsed.data)) {
      return { success: false, message: "Không thể lưu. Kiểm tra quyền của lớp và tải lại tệp chưa gắn được vào bài." };
    }
    revalidatePath("/teacher");
    revalidatePath("/hoc-sinh");
    return { success: true, message: parsed.data.status === "PUBLISHED" ? "Đã đăng bài học cho lớp." : "Đã lưu bản nháp bài học." };
  } catch {
    return { success: false, message: "Chưa thể lưu bài học. Thầy cô hãy thử lại." };
  }
}
