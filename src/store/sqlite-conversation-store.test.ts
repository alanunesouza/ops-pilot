import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SqliteConversationStore } from "./sqlite-conversation-store.js";
import type { MessageRole } from "./types.js";

describe("SqliteConversationStore Unit Tests", () => {
  test("deve inicializar o banco em memória e permitir instanciar sem erros", () => {
    const store = new SqliteConversationStore(":memory:");
    assert.ok(store);
    assert.ok(store._db);
  });

  test("create() deve gerar um identificador UUID v4 único e válido", () => {
    const store = new SqliteConversationStore(":memory:");
    const id1 = store.create();
    const id2 = store.create();

    assert.ok(id1);
    assert.ok(id2);
    assert.notEqual(id1, id2);
    // Validação de formato UUID v4
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(id1, uuidRegex);
  });

  test("append() deve persistir mensagens com papéis 'user' e 'assistant' retornando o registro completo", () => {
    const store = new SqliteConversationStore(":memory:");
    const convId = store.create();

    const msgUser = store.append(convId, "user", "Olá, tem algum alerta ativo?");
    assert.equal(msgUser.conversationId, convId);
    assert.equal(msgUser.role, "user");
    assert.equal(msgUser.content, "Olá, tem algum alerta ativo?");
    assert.ok(msgUser.id);
    assert.ok(msgUser.createdAt);

    const msgAssistant = store.append(convId, "assistant", "Sim, temos 1 alerta crítico disparando.");
    assert.equal(msgAssistant.conversationId, convId);
    assert.equal(msgAssistant.role, "assistant");
    assert.equal(msgAssistant.content, "Sim, temos 1 alerta crítico disparando.");
  });

  test("lastMessages() deve retornar mensagens em ordem cronológica crescente (ASC)", () => {
    const store = new SqliteConversationStore(":memory:");
    const convId = store.create();

    store.append(convId, "user", "Primeira mensagem");
    store.append(convId, "assistant", "Segunda mensagem");
    store.append(convId, "user", "Terceira mensagem");

    const messages = store.lastMessages(convId, 10);
    assert.equal(messages.length, 3);
    assert.equal(messages[0].content, "Primeira mensagem");
    assert.equal(messages[1].content, "Segunda mensagem");
    assert.equal(messages[2].content, "Terceira mensagem");
  });

  test("lastMessages() deve limitar às últimas N mensagens mais recentes preservando a ordem cronológica", () => {
    const store = new SqliteConversationStore(":memory:");
    const convId = store.create();

    // Insere 15 mensagens sequenciais
    for (let i = 1; i <= 15; i++) {
      const role: MessageRole = i % 2 === 1 ? "user" : "assistant";
      store.append(convId, role, `Mensagem #${i}`);
    }

    const messages = store.lastMessages(convId, 12);
    assert.equal(messages.length, 12);
    // As mensagens retornadas devem ser da 4 até a 15
    assert.equal(messages[0].content, "Mensagem #4");
    assert.equal(messages[11].content, "Mensagem #15");
  });

  test("lastMessages() deve isolar mensagens de conversas diferentes", () => {
    const store = new SqliteConversationStore(":memory:");
    const convA = store.create();
    const convB = store.create();

    store.append(convA, "user", "Mensagem no canal A");
    store.append(convB, "user", "Mensagem no canal B");

    const messagesA = store.lastMessages(convA);
    const messagesB = store.lastMessages(convB);

    assert.equal(messagesA.length, 1);
    assert.equal(messagesA[0].content, "Mensagem no canal A");

    assert.equal(messagesB.length, 1);
    assert.equal(messagesB[0].content, "Mensagem no canal B");
  });

  test("deve rejeitar papel (role) inválido violando a restrição CHECK", () => {
    const store = new SqliteConversationStore(":memory:");
    const convId = store.create();

    assert.throws(
      () => {
        // Força papel fora do enum
        store.append(convId, "hacker" as any, "Mensagem maliciosa");
      },
      (err: any) => {
        return (
          err instanceof Error &&
          (err.message.includes("CHECK") || err.message.includes("constraint"))
        );
      }
    );
  });
});
