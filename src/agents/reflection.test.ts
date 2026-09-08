import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  withReflection,
  critique,
  evaluateAnswer,
  observationsOf,
  verdictSchema,
  CritiqueSchema,
} from "./reflection.js";
import { ReasoningStrategy, StrategyResult, TraceEvent } from "./types.js";

describe("Reflection Layer & Schemas", () => {
  test("CritiqueSchema valida parecer com sucesso", () => {
    const valid = {
      approved: true,
      feedback: "A resposta está factualmente alinhada com as observações.",
    };
    const parsed = CritiqueSchema.parse(valid);
    assert.equal(parsed.approved, true);
    assert.equal(parsed.feedback, valid.feedback);

    const verdictParsed = verdictSchema.parse(valid);
    assert.equal(verdictParsed.approved, true);
  });

  test("CritiqueSchema rejeita schema inválido", () => {
    assert.throws(() => {
      CritiqueSchema.parse({ approved: "sim", feedback: 123 });
    });
  });

  test("observationsOf extrai observações do trace formatadas", () => {
    const trace: TraceEvent[] = [
      { type: "thought", content: "Pensando na lista de alertas" },
      { type: "action", content: "Chamando ferramenta", tool: "list_alerts" },
      { type: "observation", content: '{"status":"firing","id":"alt-1"}', tool: "list_alerts" },
      { type: "answer", content: "Há 1 alerta disparando." },
    ];

    const result = observationsOf(trace);
    assert.match(result, /\[list_alerts\]/);
    assert.match(result, /alt-1/);
  });

  test("observationsOf retorna mensagem padrão quando não há observações", () => {
    const trace: TraceEvent[] = [
      { type: "thought", content: "Sem ferramentas" },
      { type: "answer", content: "Direto ao ponto" },
    ];
    assert.equal(observationsOf(trace), "Nenhuma observação registrada.");
  });

  test("evaluateAnswer funciona diretamente com criticFn customizada", async () => {
    const result = await evaluateAnswer(
      "Qual o status do alerta alt-1?",
      "O alerta alt-1 está firing.",
      "[list_alerts] status: firing",
      {
        criticFn: async () => ({
          approved: true,
          feedback: "Confirmado pelas observações.",
        }),
      }
    );

    assert.equal(result.approved, true);
    assert.equal(result.feedback, "Confirmado pelas observações.");
  });
});

describe("withReflection Decorator (User Story 1: MVP)", () => {
  test("Aprova na 1ª rodada sem necessidade de regeneração", async () => {
    let callCount = 0;
    const baseStrategy: ReasoningStrategy = {
      name: "mock-base",
      async run(input: string): Promise<StrategyResult> {
        callCount++;
        return {
          answer: "Alerta alt-1 está em firing no serviço payment-gateway.",
          trace: [
            { type: "observation", content: "alert: alt-1, status: firing, service: payment-gateway" },
            { type: "answer", content: "Alerta alt-1 está em firing no serviço payment-gateway." },
          ],
          metrics: { llmCalls: 2, latencyMs: 50 },
        };
      },
    };

    const reflected = withReflection(baseStrategy, {
      maxReflections: 2,
      criticFn: async () => ({
        approved: true,
        feedback: "Resposta precisa e fiel às observações.",
      }),
    });

    assert.equal(reflected.name, "reflect:mock-base");

    const res = await reflected.run("Verifique o status do alerta alt-1");
    assert.equal(callCount, 1);
    assert.equal(res.answer, "Alerta alt-1 está em firing no serviço payment-gateway.");
    assert.equal(res.trace.some((e) => e.type === "critique" && e.content.includes("APROVADO")), true);
  });

  test("Regenera resposta sob feedback corretivo e aprova na 2ª rodada", async () => {
    const inputsReceived: string[] = [];
    let callCount = 0;

    const baseStrategy: ReasoningStrategy = {
      name: "mock-regenerate",
      async run(input: string): Promise<StrategyResult> {
        callCount++;
        inputsReceived.push(input);

        if (callCount === 1) {
          return {
            answer: "Todos os sistemas operando normalmente.",
            trace: [
              { type: "observation", content: "alert: alt-2, status: firing, service: auth-service" },
              { type: "answer", content: "Todos os sistemas operando normalmente." },
            ],
            metrics: { llmCalls: 1, latencyMs: 30 },
          };
        }

        return {
          answer: "Correção: Há 1 alerta firing no serviço auth-service.",
          trace: [
            { type: "observation", content: "alert: alt-2, status: firing, service: auth-service" },
            { type: "answer", content: "Correção: Há 1 alerta firing no serviço auth-service." },
          ],
          metrics: { llmCalls: 1, latencyMs: 35 },
        };
      },
    };

    let criticCalls = 0;
    const reflected = withReflection(baseStrategy, {
      maxReflections: 2,
      criticFn: async (_input, result) => {
        criticCalls++;
        if (result.answer.includes("normalmente")) {
          return {
            approved: false,
            feedback: "O alerta alt-2 está firing no auth-service, não afirme que tudo está normal.",
          };
        }
        return {
          approved: true,
          feedback: "Correção verificada com sucesso contra as observações.",
        };
      },
    });

    const res = await reflected.run("Verifique a saúde dos serviços");

    assert.equal(callCount, 2);
    assert.equal(criticCalls, 2);
    assert.equal(res.answer, "Correção: Há 1 alerta firing no serviço auth-service.");
    // Injeção de feedback na 2ª rodada
    assert.match(inputsReceived[1], /Feedback corretivo do crítico/);
    assert.match(inputsReceived[1], /auth-service/);
  });

  test("Respeita estritamente o limite de maxReflections", async () => {
    let callCount = 0;
    const baseStrategy: ReasoningStrategy = {
      name: "mock-stubborn",
      async run(): Promise<StrategyResult> {
        callCount++;
        return {
          answer: `Resposta persistente ${callCount}`,
          trace: [{ type: "answer", content: `Resposta persistente ${callCount}` }],
          metrics: { llmCalls: 1, latencyMs: 10 },
        };
      },
    };

    const reflected = withReflection(baseStrategy, {
      maxReflections: 2,
      criticFn: async () => ({
        approved: false,
        feedback: "Ainda reprovado.",
      }),
    });

    const res = await reflected.run("Qualquer pergunta");

    assert.equal(callCount, 2);
    assert.equal(res.answer, "Resposta persistente 2");
    const critiqueEvents = res.trace.filter((e) => e.type === "critique");
    assert.equal(critiqueEvents.length, 2);
    assert.equal(critiqueEvents[1].content.includes("REPROVADO"), true);
  });
});

describe("Trace & Metrics Aggregation (User Story 2)", () => {
  test("Acumula cronologicamente traces e soma métricas de chamadas e latência", async () => {
    let round = 0;
    const baseStrategy: ReasoningStrategy = {
      name: "mock-metrics",
      async run(): Promise<StrategyResult> {
        round++;
        return {
          answer: `Resposta round ${round}`,
          trace: [
            { type: "thought", content: `Pensamento ${round}` },
            { type: "observation", content: `Observação ${round}` },
          ],
          metrics: { llmCalls: 3, latencyMs: 40 },
        };
      },
    };

    const reflected = withReflection(baseStrategy, {
      maxReflections: 2,
      criticFn: async () => {
        if (round === 1) {
          return { approved: false, feedback: "Reprovado no round 1." };
        }
        return { approved: true, feedback: "Aprovado no round 2." };
      },
    });

    const res = await reflected.run("Teste métricas");

    // llmCalls: (3 da base rodada 1 + 1 do crítico rodada 1) + (3 da base rodada 2 + 1 do crítico rodada 2) = 8
    assert.equal(res.metrics.llmCalls, 8);
    assert.equal(res.metrics.latencyMs >= 0, true);

    // Verificação da ordem cronológica do trace
    const types = res.trace.map((e) => e.type);
    assert.deepEqual(types, [
      "thought",
      "observation",
      "critique", // Crítico rodada 1
      "thought",
      "observation",
      "critique", // Crítico rodada 2
    ]);

    assert.match(res.trace[2].content, /REPROVADO/);
    assert.match(res.trace[5].content, /APROVADO/);
  });

  test("Trata graciosamente erro inesperado na estratégia base sem quebrar a execução", async () => {
    const failingStrategy: ReasoningStrategy = {
      name: "mock-error",
      async run(): Promise<StrategyResult> {
        throw new Error("Falha temporária de conexão no provedor");
      },
    };

    const reflected = withReflection(failingStrategy, { maxReflections: 2 });
    const res = await reflected.run("Teste de falha");

    assert.match(res.answer, /Falha temporária de conexão/);
    assert.equal(res.trace.some((e) => e.type === "critique" && e.content.includes("Falha no ciclo")), true);
  });
});
