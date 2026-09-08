import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PlanSchema, ActSchema } from "./plan-and-execute.js";

describe("Plan-and-Execute Schemas & Boundaries", () => {
  test("PlanSchema valida listas de passos com sucesso", () => {
    const validPlan = {
      steps: [
        "Verificar alertas com status firing",
        "Abrir incidente crítico para o payment-gateway",
      ],
    };

    const parsed = PlanSchema.parse(validPlan);
    assert.equal(parsed.steps.length, 2);
    assert.equal(parsed.steps[0], "Verificar alertas com status firing");
  });

  test("PlanSchema rejeita listas vazias", () => {
    assert.throws(() => {
      PlanSchema.parse({ steps: [] });
    });
  });

  test("ActSchema valida decisão de finish", () => {
    const finishAction = {
      action: "finish",
      response: "O incidente foi mitigado com sucesso após reinicialização.",
    };

    const parsed = ActSchema.parse(finishAction);
    assert.equal(parsed.action, "finish");
    assert.equal(parsed.response, finishAction.response);
  });

  test("ActSchema valida decisão de continue com remainingSteps", () => {
    const continueAction = {
      action: "continue",
      remainingSteps: ["Aguardar estabilização", "Resolver o incidente"],
    };

    const parsed = ActSchema.parse(continueAction);
    assert.equal(parsed.action, "continue");
    assert.equal(parsed.remainingSteps?.length, 2);
  });
});
