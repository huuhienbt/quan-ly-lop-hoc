import { getCurrentUser } from "@/lib/rbac";
import { getCurrentStudentAccount } from "@/lib/student-session";
import { readLessonAsset } from "@/lib/lesson-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  Vary: "Cookie",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, student, staff] = await Promise.all([params, getCurrentStudentAccount(), getCurrentUser()]);
    const asset = await readLessonAsset(id, { staffId: staff?.id, studentId: student?.id, version: student?.session_version });
    if (!asset) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(asset.bytes), { headers: { ...headers, "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes.length), "Content-Disposition": asset.mime === "application/pdf" ? 'inline; filename="tai-lieu.pdf"' : "inline",
    } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
