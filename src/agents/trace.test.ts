import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toTrace, lastText, countAiMessages, formatTraceEvent } from "./trace.js";
import { AIMessage, ToolMessage, HumanMessage } from "@langchain/core/messages";

describe("Trace and Metrics Utilities", () => {
  test("toTrace converte sequência de mensagens em eventos tipados", () => {
    const messages = [
      new HumanMessage("Verifique os alertas ativos"),
      new AIMessage({
        content: "Vou verificar os alertas ativos agora.",
        tool_calls: [
          {
            name: "list_alerts",
            args: { status: "firing" },
            id: "call_123",
          },
        ],
      }),
      new ToolMessage({
        content: JSON.stringify([{ id: "alt-001", title: "DB connection pool exhaustion" }]),
        name: "list_alerts",
        tool_call_id: "call_123",
      }),
      new AIMessage({
        content: "Encontrei 1 alerta ativo referente ao esgotamento do pool de conexões.",
      }),
    ];

    const trace = toTrace(messages);

    assert.equal(trace.length, 4);
    assert.equal(trace[0].type, "thought");
    assert.equal(trace[0].content, "Vou verificar os alertas ativos agora.");

    assert.equal(trace[1].type, "action");
    assert.equal(trace[1].tool, "list_alerts");
    assert.deepEqual(trace[1].args, { status: "firing" });

    assert.equal(trace[2].type, "observation");
    assert.ok(trace[2].content.includes("alt-001"));

    assert.equal(trace[3].type, "answer");
    assert.ok(trace[3].content.includes("Encontrei 1 alerta ativo"));
  });

  test("lastText extrai a última mensagem de texto da IA", () => {
    const messages = [
      new HumanMessage("Olá"),
      new AIMessage("Primeira resposta intermediária"),
      new AIMessage("Resposta final conclusiva"),
    ];

    assert.equal(lastText(messages), "Resposta final conclusiva");
  });

  test("countAiMessages conta corretamente mensagens do modelo", () => {
    const messages = [
      new HumanMessage("Olá"),
      new AIMessage("Resposta 1"),
      new ToolMessage({ content: "ok", name: "tool", tool_call_id: "1" }),
      new AIMessage("Resposta 2"),
    ];

    assert.equal(countAiMessages(messages), 2);
  });

  test("formatTraceEvent formata action e observation com tags legíveis", () => {
    const actionFormatted = formatTraceEvent({
      type: "action",
      content: "Chamada de ferramenta",
      tool: "open_incident",
      args: { service: "payment-gateway", severity: "critical" },
    });
    assert.ok(actionFormatted.includes("[TRACE] [ACTION] open_incident"));
    assert.ok(actionFormatted.includes("payment-gateway"));

    const thoughtFormatted = formatTraceEvent({
      type: "thought",
      content: "Pensando na estratégia de mitigação",
    });
    assert.equal(thoughtFormatted, "[TRACE] [THOUGHT] Pensando na estratégia de mitigação");
  });
});
