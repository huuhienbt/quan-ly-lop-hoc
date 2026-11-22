import { getCurrentUser } from "@/lib/rbac";
import { LessonFileError, stageLessonAsset } from "@/lib/lesson-assets";
import { PostImageValidationError } from "@/lib/post-images";
import { MAX_LESSON_PDF } from "@/lib/lessons";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const bad = (message: string, status: number) => Response.json({ message }, { status, headers });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const site = request.headers.get("sec-fetch-site");
  if (!origin || !host || (site && site !== "same-origin") || URL.parse(origin)?.host !== host) {
    return bad("Yêu cầu tải tệp không hợp lệ.", 403);
  }
  if (Number(request.headers.get("content-length")) > MAX_LESSON_PDF + 65536) return bad("Tệp không quá 3 MB.", 413);
  try {
    const actor = await getCurrentUser();
    if (!actor || (actor.role !== "TEACHER" && actor.role !== "SUPER_ADMIN")) return bad("Thầy cô cần đăng nhập để tải tệp.", 403);
    const form = await request.formData().catch(() => null);
    const file = form?.get("file"), classId = form?.get("class_id"), kind = form?.get("kind");
    if (!(file instanceof File) || typeof classId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(classId) || (kind !== "image" && kind !== "pdf")) {
      return bad("Tệp hoặc thông tin lớp chưa hợp lệ.", 400);
    }
    return Response.json(await stageLessonAsset(actor.id, classId, kind, file), { headers });
  } catch (error) {
    if (error instanceof LessonFileError || error instanceof PostImageValidationError) return bad(error.message, 400);
    return bad("Chưa thể tải tệp. Thầy cô hãy thử lại.", 503);
  }
}
