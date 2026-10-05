import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { composePromptWithHistory } from "./prompt-composer.js";
import type { ConversationMessage } from "../store/types.js";

describe("Prompt Composer Unit Tests", () => {
  test("deve retornar apenas a mensagem quando não houver histórico ou for vazio", () => {
    assert.equal(composePromptWithHistory("Olá"), "Olá");
    assert.equal(composePromptWithHistory("Olá", []), "Olá");
    assert.equal(composePromptWithHistory("Olá", undefined), "Olá");
  });

  test("deve formatar bloco [Histórico da Conversa] com os papéis e turnos correspondentes", () => {
    const history: ConversationMessage[] = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        role: "user",
        content: "Quantos alertas temos?",
        createdAt: "2026-10-04T00:00:00.000Z",
      },
      {
        id: "msg-2",
        conversationId: "conv-1",
        role: "assistant",
        content: "Temos 3 alertas firing.",
        createdAt: "2026-10-04T00:00:01.000Z",
      },
    ];

    const result = composePromptWithHistory("Abra incidente para o primeiro", history);

    const expected =
      "[Histórico da Conversa]\n" +
      "User: Quantos alertas temos?\n" +
      "Assistant: Temos 3 alertas firing.\n\n" +
      "[Mensagem Atual]\n" +
      "Abra incidente para o primeiro";

    assert.equal(result, expected);
  });

  test("deve formatar mensagens do tipo system se presentes", () => {
    const history: ConversationMessage[] = [
      {
        id: "msg-sys",
        conversationId: "conv-1",
        role: "system",
        content: "Modo plantão crítico ativado.",
        createdAt: "2026-10-04T00:00:00.000Z",
      },
    ];

    const result = composePromptWithHistory("Status geral?", history);

    assert.ok(result.includes("System: Modo plantão crítico ativado."));
    assert.ok(result.includes("[Mensagem Atual]\nStatus geral?"));
  });

  test("deve formatar bloco [Memórias do Operador] quando houver memórias sem histórico", () => {
    const memories = [
      {
        id: "mem-1",
        userId: "usr-1",
        fact: "O operador prefere chavear tráfego antes de reiniciar serviços.",
        embedding: new Float32Array(384),
        createdAt: "2026-10-04T00:00:00.000Z",
      },
    ];

    const result = composePromptWithHistory("Qual procedimento adotar?", undefined, memories);

    const expected =
      "[Memórias do Operador]\n" +
      "- O operador prefere chavear tráfego antes de reiniciar serviços.\n\n" +
      "[Mensagem Atual]\n" +
      "Qual procedimento adotar?";

    assert.equal(result, expected);
  });

  test("deve formatar bloco de memórias e de histórico conjuntamente na ordem especificada", () => {
    const memories = [
      {
        id: "mem-1",
        userId: "usr-1",
        fact: "O operador é responsável direto pelos serviços auth e payment.",
        embedding: new Float32Array(384),
        createdAt: "2026-10-04T00:00:00.000Z",
      },
    ];

    const history: ConversationMessage[] = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        role: "user",
        content: "Alerta em auth.",
        createdAt: "2026-10-04T00:00:00.000Z",
      },
    ];

    const result = composePromptWithHistory("O que fazer?", history, memories);

    const expected =
      "[Memórias do Operador]\n" +
      "- O operador é responsável direto pelos serviços auth e payment.\n\n" +
      "[Histórico da Conversa]\n" +
      "User: Alerta em auth.\n\n" +
      "[Mensagem Atual]\n" +
      "O que fazer?";

    assert.equal(result, expected);
  });
});
