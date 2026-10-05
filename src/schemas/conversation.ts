import { z } from "zod";

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const ConversationMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().min(1),
  role: MessageRoleSchema,
  content: z.string().min(1),
  createdAt: z.string(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
