import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetupState } from "@/lib/config";
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
    const [{ id }, session] = await Promise.all([params, getSetupState().sessionReady ? getServerSession(authOptions) : null]);
    const user = session?.user;
    // The file read itself checks the live account and class assignment,
    // so loading the full student/staff profile first would duplicate work.
    const viewer = user?.kind === "student"
      ? { studentId: user.studentAccountId, version: user.studentSessionVersion }
      : { staffId: user?.id };
    const asset = await readLessonAsset(id, viewer);
    if (!asset) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(asset.bytes), { headers: { ...headers, "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes.length), "Content-Disposition": asset.mime === "application/pdf" ? 'inline; filename="tai-lieu.pdf"' : "inline",
    } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
