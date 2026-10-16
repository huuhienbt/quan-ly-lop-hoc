"use server";

import { ChatError, hideChatMessage, resolveChatIdentity, sendChatMessage } from "@/lib/class-chat";
import { chatHideSchema, chatSendSchema } from "@/lib/chat-schemas";

export interface ChatActionState { success: boolean; message: string; message_id?: string }
function fields(formData: FormData): Record<string, FormDataEntryValue> | null {
  const entries = [...formData.entries()].filter(([key]) => !key.startsWith("$ACTION_"));
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return null;
  return Object.fromEntries(entries);
}
function failure(error?: unknown): ChatActionState {
  return { success: false, message: error instanceof ChatError ? error.message
    : "Chưa lưu được tin nhắn. Hãy thử lại sau nhé." };
}
export async function sendChatMessageAction(_previous: ChatActionState, formData: FormData): Promise<ChatActionState> {
  const parsed = chatSendSchema.safeParse(fields(formData));
  if (!parsed.success) return failure(new ChatError(400, "Tin nhắn cần có từ 1 đến 2.000 ký tự. Hãy kiểm tra lại phòng đang chọn."));
  try {
    const identity = await resolveChatIdentity(parsed.data.mode);
    const saved = await sendChatMessage(identity, parsed.data);
    return { success: true, message: "Đã gửi tin nhắn.", message_id: saved.id };
  } catch (error) { return failure(error); }
}
export async function hideChatMessageAction(_previous: ChatActionState, formData: FormData): Promise<ChatActionState> {
  const parsed = chatHideSchema.safeParse(fields(formData));
  if (!parsed.success) return failure(new ChatError(400, "Thông tin tin nhắn chưa hợp lệ. Thầy cô hãy tải lại phòng trò chuyện."));
  try {
    const identity = await resolveChatIdentity("teacher");
    await hideChatMessage(identity, parsed.data);
    return { success: true, message: "Đã ẩn tin nhắn.", message_id: parsed.data.message_id };
  } catch (error) { return failure(error); }
}
