import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { Server } from "node:http";
import { createApp, runChat } from "./app.js";
import { FakeReasoningStrategy } from "./fake-strategy.js";
import { StrategyRegistry } from "../agents/index.js";
import { SqliteConversationStore } from "../store/sqlite-conversation-store.js";
import { SqliteMemoryStore } from "../memory/memory-store.js";

describe("HTTP Chat Server Integration Tests (POST /chat)", () => {
  let server: Server;
  let baseUrl: string;
  let registry: StrategyRegistry;
  let conversationStore: SqliteConversationStore;
  let memoryStore: SqliteMemoryStore;
  let fakeReact: FakeReasoningStrategy;

  before(async () => {
    // Configura um registry isolado com estratégias determinísticas simuladas
    registry = new StrategyRegistry();

    fakeReact = new FakeReasoningStrategy({
      name: "react",
      answer: "Resposta ReAct determinística",
    });

    const fakePlan = new FakeReasoningStrategy({
      name: "plan-and-execute",
      answer: "Resposta Plan-and-Execute determinística",
    });

    const fakeSlow = new FakeReasoningStrategy({
      name: "slow-agent",
      answer: "Resposta atrasada",
      delayMs: 250, // Maior que o timeout configurado para teste de 504
    });

    registry.register("react", fakeReact);
    registry.register("plan-and-execute", fakePlan);
    registry.register("slow-agent", fakeSlow);

    // Cria stores isolados em memória para testes
    conversationStore = new SqliteConversationStore(":memory:");
    memoryStore = new SqliteMemoryStore(":memory:");

    const fakeReflectorModel = {
      withStructuredOutput: () => ({
        invoke: async () => ({ hasLearning: false }),
      }),
    };

    // Cria a aplicação com timeout reduzido (80ms) para testar 504 rapidamente
    const app = createApp({
      registry,
      timeoutMs: 80,
      conversations: conversationStore,
      memoryStore,
      reflectorModel: fakeReflectorModel,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  describe("User Story 1: Fluxo Padrão (200 OK)", () => {
    test("POST /chat com payload mínimo executa a estratégia react padrão e retorna 200 OK", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Quantos alertas estão disparando?" }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(typeof data.answer, "string");
      assert.match(data.answer, /Resposta ReAct determinística/);
      assert.equal(Array.isArray(data.trace), true);
      assert.equal(data.trace.length >= 1, true);
      assert.equal(typeof data.metrics?.llmCalls, "number");
      assert.equal(typeof data.metrics?.latencyMs, "number");
      assert.equal(typeof data.conversationId, "string");
      assert.ok(data.conversationId.length > 0);
      assert.equal(data.metrics?.historyMessages, 0);
    });
  });

  describe("User Story 2: Seleção de Estratégia e Reflection", () => {
    test("POST /chat com strategy: 'plan-and-execute' executa a estratégia solicitada", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Criar incidente",
          strategy: "plan-and-execute",
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.match(data.answer, /Resposta Plan-and-Execute determinística/);
    });

    test("POST /chat com reflect: true aplica a camada de auto-avaliação reflexiva", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Verificação com reflexão",
          strategy: "react",
          reflect: true,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(Array.isArray(data.trace), true);
      // Deve conter pelo menos um evento do tipo critique adicionado por withReflection
      const hasCritique = data.trace.some((e: { type: string }) => e.type === "critique");
      assert.equal(hasCritique, true);
    });
  });

  describe("User Story 3: Validação, Estratégia Desconhecida e Timeout", () => {
    test("POST /chat sem campo message retorna 400 Bad Request com issues do Zod", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, "Bad Request");
      assert.equal(Array.isArray(data.issues), true);
      assert.equal(data.issues.length >= 1, true);
    });

    test("POST /chat com message em branco ('  ') retorna 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "   " }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, "Bad Request");
    });

    test("POST /chat com estratégia não registrada retorna 422 Unprocessable Entity", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Consulta",
          strategy: "estrategia-inexistente-123",
        }),
      });

      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.error, "Unprocessable Entity");
      assert.match(data.message, /Estratégia desconhecida/);
      assert.match(data.message, /react/);
    });

    test("POST /chat com execução lenta excede timeout e retorna 504 Gateway Timeout", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Operação lenta",
          strategy: "slow-agent",
        }),
      });

      assert.equal(res.status, 504);
      const data = await res.json();
      assert.equal(data.error, "Gateway Timeout");
      assert.match(data.message, /tempo limite/);
    });
  });

  describe("User Story 4: Conversa Persistente Multi-Turnos e Métrica historyMessages", () => {
    test("POST /chat sem conversationId gera nova sessão e primeira mensagem tem historyMessages: 0", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Início da conversa" }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.conversationId);
      assert.equal(data.metrics.historyMessages, 0);

      // Verifica se as 2 mensagens (user e assistant) foram salvas no store
      const stored = conversationStore.lastMessages(data.conversationId);
      assert.equal(stored.length, 2);
      assert.equal(stored[0].role, "user");
      assert.equal(stored[0].content, "Início da conversa");
      assert.equal(stored[1].role, "assistant");
    });

    test("POST /chat com conversationId existente reutiliza a sessão e incrementa historyMessages", async () => {
      // 1º turno
      const res1 = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Primeira interação" }),
      });
      const data1 = await res1.json();
      const convId = data1.conversationId;
      assert.equal(data1.metrics.historyMessages, 0);

      // 2º turno
      const res2 = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Segunda interação",
          conversationId: convId,
        }),
      });
      const data2 = await res2.json();
      assert.equal(data2.conversationId, convId);
      // Deve conter as 2 mensagens anteriores (user + assistant do 1º turno)
      assert.equal(data2.metrics.historyMessages, 2);

      // 3º turno
      const res3 = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Terceira interação",
          conversationId: convId,
        }),
      });
      const data3 = await res3.json();
      assert.equal(data3.conversationId, convId);
      // Deve conter 4 mensagens anteriores (2 do 1º turno + 2 do 2º turno)
      assert.equal(data3.metrics.historyMessages, 4);
    });

    test("POST /chat limita o histórico a no máximo 12 mensagens mesmo com mais mensagens acumuladas", async () => {
      const convId = conversationStore.create();

      // Preenche previamente com 16 mensagens (8 turnos)
      for (let i = 1; i <= 8; i++) {
        conversationStore.append(convId, "user", `Pergunta ${i}`);
        conversationStore.append(convId, "assistant", `Resposta ${i}`);
      }

      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Nova pergunta após 16 mensagens",
          conversationId: convId,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.conversationId, convId);
      // historyMessages deve ser exatamente 12 (teto configurado)
      assert.equal(data.metrics.historyMessages, 12);
    });

    test("POST /chat com conversationId em formato vazio retorna 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Mensagem de teste",
          conversationId: "   ",
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, "Bad Request");
    });
  });

  describe("User Story 5: Memória Semântica com userId (US3)", () => {
    test("POST /chat com userId recupera fatos relevantes e injeta no contexto da estratégia", async () => {
      const userId = "usr-ops-alan";
      await memoryStore.remember(userId, "O operador prefere chavear tráfego para a rota de contingência.");
      await memoryStore.remember(userId, "O operador é o responsável pelo serviço de pagamentos.");

      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Qual o procedimento de contingência de tráfego?",
          userId,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.answer);

      // Verifica se a estratégia recebeu as memórias injetadas
      const lastInput = fakeReact.lastInput as { message: string; memories?: any[] };
      assert.ok(lastInput);
      assert.ok(lastInput.memories && lastInput.memories.length >= 1);
      assert.match(lastInput.memories[0].fact, /rota de contingência/);
    });

    test("POST /chat sem userId não executa injeção de memórias e funciona normalmente", async () => {
      const res = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Qual o status geral dos sistemas?",
        }),
      });

      assert.equal(res.status, 200);
      const lastInput = fakeReact.lastInput as { message: string; memories?: any[] };
      assert.ok(lastInput);
      assert.equal(lastInput.memories, undefined);
    });
  });

  describe("User Story 6: Refletor de Aprendizado Assíncrono (009-learning-reflector)", () => {
    test("runChat com userId dispara reflectLearning em background e persiste fato", async () => {
      const memStore = new SqliteMemoryStore(":memory:");
      const fakeReflectorModel = {
        withStructuredOutput: () => ({
          invoke: async () => ({
            hasLearning: true,
            fact: "O operador atua exclusivamente no plantão noturno.",
          }),
        }),
      };

      let reflected: any;
      const response = await runChat(
        {
          message: "Meu turno oficial é o plantão noturno",
          userId: "usr-noturno",
          strategy: "react",
          reflect: false,
        },
        {
          conversations: conversationStore,
          memoryStore: memStore,
          strategy: fakeReact,
          reflectorModel: fakeReflectorModel,
          onReflect: (r: any) => {
            reflected = r;
          },
        }
      );

      assert.ok(response);
      assert.ok(response.answer);

      // Aguarda resolução da promise em background
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.ok(reflected);
      assert.equal(reflected.hasLearning, true);
      assert.equal(reflected.fact, "O operador atua exclusivamente no plantão noturno.");

      const memories = memStore._all("usr-noturno");
      assert.equal(memories.length, 1);
      assert.equal(memories[0].fact, "O operador atua exclusivamente no plantão noturno.");
    });
  });
});
