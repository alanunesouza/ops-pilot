import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { reflectLearning } from "./reflector.js";
import { SqliteMemoryStore } from "./memory-store.js";
import type { LearningReflection } from "../schemas/memory.js";

class FakeStructuredModel {
  constructor(private cannedResult: LearningReflection) {}

  withStructuredOutput() {
    return {
      invoke: async (_messages: any[]) => {
        return this.cannedResult;
      },
    };
  }

  async invoke(_messages: any[]) {
    return this.cannedResult;
  }
}

describe("Learning Reflector Unit Tests (src/memory/reflector.ts)", () => {
  test("US1: deve destilar preferência durável e gravar no MemoryStore via remember", async () => {
    const memoryStore = new SqliteMemoryStore(":memory:");
    const fakeModel = new FakeStructuredModel({
      hasLearning: true,
      fact: "O operador prefere chavear tráfego para a rota de contingência antes de reiniciar pods.",
    });

    const result = await reflectLearning(
      "usr-1",
      "Sempre chaveie o tráfego para contingência antes de reiniciar qualquer serviço.",
      { model: fakeModel, memoryStore }
    );

    assert.equal(result.hasLearning, true);
    assert.equal(
      result.fact,
      "O operador prefere chavear tráfego para a rota de contingência antes de reiniciar pods."
    );

    const all = memoryStore._all("usr-1");
    assert.equal(all.length, 1);
    assert.equal(
      all[0].fact,
      "O operador prefere chavear tráfego para a rota de contingência antes de reiniciar pods."
    );
  });

  test("US1: deve descartar mensagens ordinárias e perguntas sem diretrizes permanentes", async () => {
    const memoryStore = new SqliteMemoryStore(":memory:");
    const fakeModel = new FakeStructuredModel({
      hasLearning: false,
    });

    const result = await reflectLearning(
      "usr-1",
      "Quantos alertas críticos temos no momento?",
      { model: fakeModel, memoryStore }
    );

    assert.equal(result.hasLearning, false);
    assert.equal(result.fact, undefined);
    assert.equal(memoryStore._all("usr-1").length, 0);
  });

  test("US2: deve rejeitar mensagens contendo senhas, chaves de API ou segredos", async () => {
    const memoryStore = new SqliteMemoryStore(":memory:");
    const fakeModel = new FakeStructuredModel({
      hasLearning: true,
      fact: "O operador informou a chave de API.",
    });

    const sensitiveInputs = [
      "Minha senha do banco é super_secret_123!",
      "Aqui está meu bearer token: eyJhbGciOi...",
      "Use esta api_key para testar o provedor",
      "Chave secreta de produção: secret-xyz",
    ];

    for (const msg of sensitiveInputs) {
      const result = await reflectLearning("usr-1", msg, {
        model: fakeModel,
        memoryStore,
      });

      assert.equal(result.hasLearning, false, `Deveria ter rejeitado: ${msg}`);
      assert.equal(result.fact, undefined);
    }

    assert.equal(memoryStore._all("usr-1").length, 0);
  });

  test("US2: deve descartar quando o fato retornado pelo modelo violar o guardrail de segredos", async () => {
    const memoryStore = new SqliteMemoryStore(":memory:");
    const fakeModel = new FakeStructuredModel({
      hasLearning: true,
      fact: "O operador tem a password admin",
    });

    const result = await reflectLearning(
      "usr-1",
      "Acesso ao cluster administrativo",
      { model: fakeModel, memoryStore }
    );

    assert.equal(result.hasLearning, false);
    assert.equal(memoryStore._all("usr-1").length, 0);
  });

  test("deve retornar hasLearning: false imediatamente para mensagens em branco", async () => {
    const memoryStore = new SqliteMemoryStore(":memory:");
    const result = await reflectLearning("usr-1", "   ", { memoryStore });
    assert.equal(result.hasLearning, false);
    assert.equal(memoryStore._all("usr-1").length, 0);
  });
});
