import { getStudentRequestIdentity } from "@/lib/student-session";
import { readStudentAvatar } from "@/lib/student-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
  Vary: "Cookie",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [identity, { id }] = await Promise.all([getStudentRequestIdentity(), params]);
    if (!identity) return new Response(null, { status: 404, headers });
    const bytes = await readStudentAvatar(identity, id);
    if (!bytes) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp", "Content-Length": String(bytes.length) } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
