import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatMetrics } from "./trace.js";
import { ExecutionMetrics } from "./types.js";

describe("Execution Metrics Validation", () => {
  test("formatMetrics gera texto estruturado com contagem e latência", () => {
    const metrics: ExecutionMetrics = {
      llmCalls: 4,
      latencyMs: 1250,
    };
    const formatted = formatMetrics(metrics);
    assert.ok(formatted.includes("4 chamadas LLM"));
    assert.ok(formatted.includes("1250ms latência"));
  });
});
