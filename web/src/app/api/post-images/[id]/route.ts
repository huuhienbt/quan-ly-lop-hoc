import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSetupState } from "@/lib/config";
import { getPostImage, type PostImageIdentity } from "@/lib/post-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  Vary: "Cookie",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = getSetupState().sessionReady ? await getServerSession(authOptions) : null;
    const user = session?.user;
    const identity: PostImageIdentity = user?.kind === "student"
      ? { studentAccountId: user.studentAccountId, studentSessionVersion: user.studentSessionVersion }
      : { staffId: user?.id };
    const image = await getPostImage(id, identity);
    if (!image) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(image.bytes), { headers: {
      ...headers, "Content-Type": image.contentType, "Content-Length": String(image.byteSize),
    } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
