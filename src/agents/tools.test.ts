import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { listAlerts, openIncident, resolveIncident } from "./tools.js";
import { memoryStore } from "../store/memory.js";

describe("Operational Tools Execution", () => {
  beforeEach(() => {
    memoryStore.resetStore();
  });

  test("listAlerts retorna lista serializada em JSON filtrando por status", async () => {
    const rawResult = await listAlerts.invoke({ status: "firing" });
    const alerts = JSON.parse(rawResult);

    assert.ok(Array.isArray(alerts));
    assert.equal(alerts.length, 3);
    assert.ok(alerts.every((a: any) => a.status === "firing"));
  });

  test("openIncident cria incidente com sucesso e retorna JSON válido", async () => {
    const rawResult = await openIncident.invoke({
      title: "Falha de autenticação em cascata",
      service: "auth-service",
      severity: "high",
    });

    const incident = JSON.parse(rawResult);
    assert.ok(incident.id.startsWith("inc-"));
    assert.equal(incident.service, "auth-service");
    assert.equal(incident.severity, "high");
    assert.equal(incident.status, "open");
  });

  test("resolveIncident atualiza status e trata ID inexistente sem estourar exceção não tratada", async () => {
    const createdRaw = await openIncident.invoke({
      title: "Spike de latência temporário",
      service: "order-api",
      severity: "medium",
    });
    const created = JSON.parse(createdRaw);

    const resolvedRaw = await resolveIncident.invoke({ id: created.id });
    const resolved = JSON.parse(resolvedRaw);
    assert.equal(resolved.status, "resolved");

    const errorRaw = await resolveIncident.invoke({ id: "inc-nao-existe" });
    assert.ok(errorRaw.includes("Erro ao resolver incidente"));
  });
});
