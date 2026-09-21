import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  listAlerts,
  openIncident,
  resolveIncident,
  listIncidents,
  consultarRunbook,
  checkProviderStatus,
  createCheckProviderStatusTool,
  opsTools,
} from "./tools.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { setOpsStore } from "./ops-store.js";

describe("Operational Tools Execution com SQLite (:memory:)", () => {
  let testStore: SqliteOpsStore;

  beforeEach(() => {
    testStore = new SqliteOpsStore(":memory:");
    testStore.seed();
    setOpsStore(testStore);
  });

  test("listAlerts retorna lista serializada em JSON filtrando por status", async () => {
    const rawResult = await listAlerts.invoke({ status: "firing" });
    const alerts = JSON.parse(rawResult);

    assert.ok(Array.isArray(alerts));
    assert.equal(alerts.length, 3);
    assert.ok(alerts.every((a: any) => a.status === "firing"));

    const resolvedRaw = await listAlerts.invoke({ status: "resolved" });
    const resolved = JSON.parse(resolvedRaw);
    assert.equal(resolved.length, 3);

    const allRaw = await listAlerts.invoke({ status: "all" });
    const all = JSON.parse(allRaw);
    assert.equal(all.length, 6);
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

    const resolvedRaw = await resolveIncident.invoke({
      id: created.id,
      summary: "Restart dos pods concluído",
    });
    const resolved = JSON.parse(resolvedRaw);
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.summary, "Restart dos pods concluído");

    const errorRaw = await resolveIncident.invoke({ id: "inc-nao-existe" });
    assert.ok(errorRaw.includes("Erro ao resolver incidente"));
  });

  test("listIncidents lista incidentes com filtro por status (open, resolved, all)", async () => {
    const inc1Raw = await openIncident.invoke({
      title: "Incidente 1",
      service: "payment-gateway",
      severity: "critical",
    });
    const inc1 = JSON.parse(inc1Raw);

    await openIncident.invoke({
      title: "Incidente 2",
      service: "auth-service",
      severity: "low",
    });

    // Default open
    const openRaw = await listIncidents.invoke({});
    const openList = JSON.parse(openRaw);
    assert.equal(openList.length, 2);

    // Resolve 1
    await resolveIncident.invoke({ id: inc1.id, summary: "Mitigado" });

    const openAfterRaw = await listIncidents.invoke({ status: "open" });
    const openAfter = JSON.parse(openAfterRaw);
    assert.equal(openAfter.length, 1);

    const resolvedAfterRaw = await listIncidents.invoke({ status: "resolved" });
    const resolvedAfter = JSON.parse(resolvedAfterRaw);
    assert.equal(resolvedAfter.length, 1);

    const allAfterRaw = await listIncidents.invoke({ status: "all" });
    const allAfter = JSON.parse(allAfterRaw);
    assert.equal(allAfter.length, 2);
  });

  test("consultarRunbook recupera guia para serviço existente e lida com ausência", async () => {
    const rbPayments = await consultarRunbook.invoke({ service: "payments" });
    assert.match(rbPayments, /Gateway de Pagamentos|payments/i);

    const rbCheckout = await consultarRunbook.invoke({ service: "checkout" });
    assert.match(rbCheckout, /Checkout|Pedidos/i);

    const rbInexistente = await consultarRunbook.invoke({ service: "servico-fantasma" });
    assert.match(rbInexistente, /Nenhum runbook operacional encontrado/i);
  });

  test("check_provider_status retorna status formatado para github e cloudflare offline via injeção", async () => {
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("githubstatus")) {
        return new Response(
          JSON.stringify({
            status: { indicator: "none", description: "All Systems Operational" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("cloudflarestatus")) {
        return new Response(
          JSON.stringify({
            status: { indicator: "minor", description: "Minor Cloudflare Outage" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    };

    const tool = createCheckProviderStatusTool(mockFetch);

    // Default: github
    const resDefault = await tool.invoke({});
    assert.equal(resDefault, "github está none - All Systems Operational");

    // Explicit: cloudflare
    const resCf = await tool.invoke({ provider: "cloudflare" });
    assert.equal(resCf, "cloudflare está minor - Minor Cloudflare Outage");
  });

  test("check_provider_status executa retry em caso de HTTP 500 e recupera na 2ª tentativa", async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Internal Server Error", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          status: { indicator: "none", description: "Recovered on attempt 2" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const tool = createCheckProviderStatusTool(mockFetch);
    const result = await tool.invoke({ provider: "github" });

    assert.equal(callCount, 2);
    assert.equal(result, "github está none - Recovered on attempt 2");
  });

  test("check_provider_status trata erro de timeout/rede e retorna observação amigável na 2ª tentativa", async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async () => {
      callCount++;
      throw new Error("The operation was aborted due to timeout");
    };

    const tool = createCheckProviderStatusTool(mockFetch);
    const result = await tool.invoke({ provider: "github" });

    assert.equal(callCount, 2);
    assert.match(result, /não consegui consultar o status de github/);
    assert.match(result, /Responda com base nos alertas internos e avise o plantonista da limitação/);
  });

  test("check_provider_status trata HTTP 4xx sem retry desnecessário", async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async () => {
      callCount++;
      return new Response("Not Found", { status: 404 });
    };

    const tool = createCheckProviderStatusTool(mockFetch);
    const result = await tool.invoke({ provider: "cloudflare" });

    assert.equal(callCount, 1);
    assert.equal(result, "status page de cloudflare respondeu HTTP 404");
  });

  test("check_provider_status captura resposta inválida (fora do schema Zod) e retorna mensagem tratada", async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ algo: "inesperado" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const tool = createCheckProviderStatusTool(mockFetch);
    const result = await tool.invoke({ provider: "github" });

    assert.equal(callCount, 2);
    assert.match(result, /não consegui consultar o status de github/);
    assert.match(result, /avise o plantonista da limitação/);
  });

  test("todas as 6 tools seguem as 6 regras com descrições semânticas e esquemas Zod", () => {
    assert.equal(opsTools.length, 6);

    for (const t of opsTools) {
      assert.ok(t.description.length > 30, `Tool ${t.name} deve ter descrição detalhada`);
      assert.match(
        t.description,
        /Use quando/i,
        `Tool ${t.name} deve especificar 'Use quando'`
      );
      assert.match(
        t.description,
        /NÃO use|Não use/i,
        `Tool ${t.name} deve especificar 'NÃO use'`
      );
    }
  });
});
