import { z } from "zod";

export interface ChatMessage {
  id: string;
  sender_name: string;
  sender_kind: "TEACHER" | "STUDENT";
  body: string;
  created_at: string;
  is_own: boolean;
  is_hidden: boolean;
}
export interface ChatStudent {
  enrollment_id: string;
  student_name: string;
  last_message_at: string | null;
}
export interface ChatSnapshot {
  messages: ChatMessage[];
  has_more: boolean;
  students?: ChatStudent[];
}
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const optionalIdentifier = z.union([identifier, z.literal("")]).optional().transform((value) => value || undefined);
const fields = {
  mode: z.enum(["student", "teacher"]),
  class_id: identifier,
  enrollment_id: optionalIdentifier,
  thread_enrollment_id: optionalIdentifier,
};
function validContext(value: { mode: string; enrollment_id?: string; thread_enrollment_id?: string }): boolean {
  return value.mode === "student"
    ? !!value.enrollment_id && (!value.thread_enrollment_id || value.thread_enrollment_id === value.enrollment_id)
    : !value.enrollment_id;
}
export const chatContextSchema = z.object(fields).strict().refine(validContext);
export const chatReadSchema = z.object({ ...fields, before_id: optionalIdentifier, through_id: optionalIdentifier })
  .strict().refine(validContext).refine((value) => !value.before_id || !value.through_id);
export const chatSendSchema = z.object({
  ...fields,
  body: z.string().max(4000).transform((value) => value.normalize("NFC").trim())
    .pipe(z.string().min(1).max(2000).refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))),
  client_message_id: z.uuid(),
}).strict().refine(validContext);
export const chatHideSchema = z.object({ ...fields, mode: z.literal("teacher"), message_id: identifier }).strict().refine(validContext);
export interface ChatContext {
  mode: "student" | "teacher";
  class_id: string;
  enrollment_id?: string;
  thread_enrollment_id?: string;
}
export type ChatSendInput = z.input<typeof chatSendSchema>;
export type ChatHideInput = z.input<typeof chatHideSchema>;
