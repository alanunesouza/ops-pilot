import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { memoryStore } from "./memory.js";

describe("InMemoryStore Operations", () => {
  beforeEach(() => {
    memoryStore.resetStore();
  });

  test("seed primário contém 5 serviços e 6 alertas (3 firing, 3 resolved)", () => {
    const services = memoryStore.listServices();
    const firing = memoryStore.listAlerts("firing");
    const resolved = memoryStore.listAlerts("resolved");
    const all = memoryStore.listAlerts("all");

    assert.equal(services.length, 5);
    assert.equal(firing.length, 3);
    assert.equal(resolved.length, 3);
    assert.equal(all.length, 6);
  });

  test("permite abrir e resolver incidentes mantendo integridade", () => {
    const inc = memoryStore.openIncident(
      "Instabilidade no checkout",
      "payment-gateway",
      "critical"
    );

    assert.ok(inc.id.startsWith("inc-"));
    assert.equal(inc.status, "open");
    assert.equal(inc.severity, "critical");

    const resolved = memoryStore.resolveIncident(inc.id);
    assert.equal(resolved.id, inc.id);
    assert.equal(resolved.status, "resolved");
  });

  test("lança erro ao tentar resolver id inexistente", () => {
    assert.throws(() => {
      memoryStore.resolveIncident("inc-inexistente-999");
    }, /not found/);
  });
});
