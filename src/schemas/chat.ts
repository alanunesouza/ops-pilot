import { z } from "zod";

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1, "O campo 'message' não pode ser vazio"),
  strategy: z.string().trim().default("react"),
  reflect: z.boolean().default(false),
  conversationId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const TraceEventSchema = z.object({
  type: z.enum(["thought", "action", "observation", "plan", "critique", "answer"]),
  content: z.string(),
  tool: z.string().optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export const ExecutionMetricsSchema = z.object({
  llmCalls: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  historyMessages: z.number().int().nonnegative().default(0),
  memoriesRecalled: z.number().int().nonnegative().default(0),
});

export const ChatResponseSchema = z.object({
  conversationId: z.string().min(1),
  answer: z.string(),
  trace: z.array(TraceEventSchema),
  metrics: ExecutionMetricsSchema,
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  issues: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
