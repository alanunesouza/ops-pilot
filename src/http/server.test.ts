import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { Server } from "node:http";
import { createApp } from "./app.js";
import { FakeReasoningStrategy } from "./fake-strategy.js";
import { StrategyRegistry } from "../agents/index.js";

describe("HTTP Chat Server Integration Tests (POST /chat)", () => {
  let server: Server;
  let baseUrl: string;
  let registry: StrategyRegistry;

  before(async () => {
    // Configura um registry isolado com estratégias determinísticas simuladas
    registry = new StrategyRegistry();

    const fakeReact = new FakeReasoningStrategy({
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

    // Cria a aplicação com timeout reduzido (80ms) para testar 504 rapidamente
    const app = createApp({ registry, timeoutMs: 80 });

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
});
