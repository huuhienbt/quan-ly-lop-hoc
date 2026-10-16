import { ChatError, getChatSnapshot, resolveChatIdentity } from "@/lib/class-chat";
import { chatReadSchema } from "@/lib/chat-schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Pragma": "no-cache",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request): Promise<Response> {
  try {
    const entries = [...new URL(request.url).searchParams.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new ChatError(400, "Thông tin phòng trò chuyện bị lặp.");
    const parsed = chatReadSchema.safeParse(Object.fromEntries(entries));
    if (!parsed.success) throw new ChatError(400, "Thông tin phòng trò chuyện chưa hợp lệ.");
    const { before_id, through_id, ...context } = parsed.data;
    const identity = await resolveChatIdentity(context.mode);
    const snapshot = await getChatSnapshot(identity, context, before_id, through_id);
    return Response.json(snapshot, { headers });
  } catch (error) {
    return Response.json({ message: error instanceof ChatError ? error.message : "Chưa kết nối được phòng trò chuyện. Hãy thử lại sau nhé." },
      { status: error instanceof ChatError ? error.status : 503, headers });
  }
}
