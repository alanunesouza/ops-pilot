import { TraceEvent, ExecutionMetrics } from "./types.js";

export function toTrace(messages: any[]): TraceEvent[] {
  const trace: TraceEvent[] = [];
  const now = new Date().toISOString();

  if (!Array.isArray(messages)) return trace;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const role = msg.role || msg._getType?.() || msg.type;
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "");

    if (role === "ai" || role === "AIMessage" || role === "assistant") {
      const toolCalls = msg.tool_calls || msg.additional_kwargs?.tool_calls || [];

      if (toolCalls.length > 0) {
        if (content && content.trim() !== "") {
          trace.push({
            type: "thought",
            content: content.trim(),
            timestamp: now,
          });
        }
        for (const tc of toolCalls) {
          trace.push({
            type: "action",
            content: `Chamada da ferramenta ${tc.name}`,
            tool: tc.name,
            args: tc.args ?? (typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : {}),
            timestamp: now,
          });
        }
      } else {
        // Se for a última mensagem ou não chamar tools
        const isLast = i === messages.length - 1;
        trace.push({
          type: isLast ? "answer" : "thought",
          content: content.trim(),
          timestamp: now,
        });
      }
    } else if (role === "tool" || role === "ToolMessage") {
      trace.push({
        type: "observation",
        content: content.trim(),
        tool: msg.name,
        timestamp: now,
      });
    }
  }

  return trace;
}

export function lastText(messages: any[]): string {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const role = msg.role || msg._getType?.() || msg.type;
    if (role === "ai" || role === "AIMessage" || role === "assistant") {
      if (typeof msg.content === "string" && msg.content.trim() !== "") {
        return msg.content.trim();
      }
    }
  }
  return "";
}

export function countAiMessages(messages: any[]): number {
  if (!Array.isArray(messages)) return 0;
  return messages.filter((m) => {
    const role = m.role || m._getType?.() || m.type;
    return role === "ai" || role === "AIMessage" || role === "assistant";
  }).length;
}

export function formatTraceEvent(event: TraceEvent): string {
  const typeTag = `[${event.type.toUpperCase()}]`;
  if (event.type === "action") {
    const argsStr = event.args ? JSON.stringify(event.args) : "{}";
    return `[TRACE] ${typeTag} ${event.tool}(${argsStr})`;
  }
  if (event.type === "observation") {
    return `[TRACE] ${typeTag} ${event.content}`;
  }
  return `[TRACE] ${typeTag} ${event.content}`;
}

export function formatMetrics(metrics: ExecutionMetrics): string {
  return `📊 Métricas: ${metrics.llmCalls} chamadas LLM | ${metrics.latencyMs}ms latência`;
}
