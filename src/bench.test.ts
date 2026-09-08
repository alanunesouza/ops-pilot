import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, executeBenchmarkItem, ScenarioDefinition } from "./bench.js";
import { store } from "./store/memory.js";
import { ReasoningStrategy, StrategyResult } from "./agents/types.js";

describe("Benchmark Scenarios & Store Verifiers", () => {
  beforeEach(() => {
    store.resetStore();
  });

  test("SCENARIOS contém C1 direto, C2 estruturado e C3 dinâmico", () => {
    assert.equal(SCENARIOS.length, 3);
    assert.equal(SCENARIOS[0].id, "C1");
    assert.equal(SCENARIOS[1].id, "C2");
    assert.equal(SCENARIOS[2].id, "C3");
  });

  test("C1 verifier valida identificação correta de 1 alerta crítico e store limpo", () => {
    const c1 = SCENARIOS.find((s) => s.id === "C1")!;
    const mockResult: StrategyResult = {
      answer: "Atualmente há 1 alerta crítico disparando no serviço payment-gateway.",
      trace: [],
      metrics: { llmCalls: 2, latencyMs: 120 },
    };

    const verification = c1.verifier(mockResult);
    assert.equal(verification.passed, true);
    assert.match(verification.details, /1 alerta crítico/);
  });

  test("C1 verifier reprova se o store foi modificado com incidentes", () => {
    const c1 = SCENARIOS.find((s) => s.id === "C1")!;
    store.openIncident("Incidente indevido", "auth-service", "critical");

    const mockResult: StrategyResult = {
      answer: "Há 1 alerta crítico disparando.",
      trace: [],
      metrics: { llmCalls: 2, latencyMs: 100 },
    };

    const verification = c1.verifier(mockResult);
    assert.equal(verification.passed, false);
  });

  test("C2 verifier valida 3 incidentes criados na ordem correta e o primeiro resolvido", () => {
    const c2 = SCENARIOS.find((s) => s.id === "C2")!;

    // Simula a criação na ordem exigida: checkout, payment, catalog
    const inc1 = store.openIncident("Falha no checkout", "checkout", "high");
    store.openIncident("Falha no payment", "payment-gateway", "high");
    store.openIncident("Falha no catalog", "inventory-catalog", "high");

    // Resolve apenas o primeiro
    store.resolveIncident(inc1.id);

    const mockResult: StrategyResult = {
      answer: "Incidentes criados e primeiro resolvido.",
      trace: [],
      metrics: { llmCalls: 4, latencyMs: 300 },
    };

    const verification = c2.verifier(mockResult);
    assert.equal(verification.passed, true);
  });

  test("C2 verifier reprova se a ordem dos serviços estiver errada ou primeiro não resolvido", () => {
    const c2 = SCENARIOS.find((s) => s.id === "C2")!;

    // Ordem invertida: payment primeiro
    const inc1 = store.openIncident("Falha no payment", "payment-gateway", "high");
    store.openIncident("Falha no checkout", "checkout", "high");
    store.openIncident("Falha no catalog", "catalog", "high");
    store.resolveIncident(inc1.id);

    const mockResult: StrategyResult = {
      answer: "Incidentes criados.",
      trace: [],
      metrics: { llmCalls: 4, latencyMs: 200 },
    };

    const verification = c2.verifier(mockResult);
    assert.equal(verification.passed, false);
  });

  test("C3 verifier valida abertura para o alerta firing mais antigo e reporte de 2 restantes", () => {
    const c3 = SCENARIOS.find((s) => s.id === "C3")!;

    // O mais antigo é payment-gateway (alt-001)
    store.openIncident("Alerta mais antigo alt-001", "payment-gateway", "critical");

    const mockResult: StrategyResult = {
      answer: "Abri um incidente para o alerta alt-001 (payment-gateway) e restaram 2 alertas disparando.",
      trace: [],
      metrics: { llmCalls: 3, latencyMs: 150 },
    };

    const verification = c3.verifier(mockResult);
    assert.equal(verification.passed, true);
  });

  test("C3 verifier reprova se abrir para o serviço errado ou não citar os 2 restantes", () => {
    const c3 = SCENARIOS.find((s) => s.id === "C3")!;

    // Abriu para o serviço errado (order-api em vez do payment-gateway)
    store.openIncident("Incidente errado", "order-api", "high");

    const mockResult: StrategyResult = {
      answer: "Abri o incidente e restaram 2 alertas.",
      trace: [],
      metrics: { llmCalls: 3, latencyMs: 150 },
    };

    const verification = c3.verifier(mockResult);
    assert.equal(verification.passed, false);
  });

  test("executeBenchmarkItem reseta o store antes da execução", async () => {
    // Polui o store previamente
    store.openIncident("Lixo anterior", "auth-service", "low");
    assert.equal(store.listIncidents().length, 1);

    const mockStrategy: ReasoningStrategy = {
      name: "mock",
      async run(): Promise<StrategyResult> {
        // Ao rodar a estratégia, o store já deve ter sido resetado para 0 incidentes
        assert.equal(store.listIncidents().length, 0);
        return {
          answer: "Há 1 alerta crítico.",
          trace: [],
          metrics: { llmCalls: 1, latencyMs: 20 },
        };
      },
    };

    const c1 = SCENARIOS[0];
    const bench = await executeBenchmarkItem(c1, mockStrategy);
    assert.equal(bench.acerto, true);
  });
});
