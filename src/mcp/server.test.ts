import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOpsPilotMcpServer } from "./server.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";

describe("Servidor MCP OpsPilot (src/mcp/server.ts)", () => {
  let store: SqliteOpsStore;

  beforeEach(() => {
    store = new SqliteOpsStore(":memory:");
    store.seed();
  });

  test("US1 [P1 MVP]: Conecta via InMemoryTransport e lista o catálogo de tools (tools/list)", async () => {
    const server = createOpsPilotMcpServer(store);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);

    assert.ok(toolNames.includes("list_alerts"), "Deve incluir list_alerts");
    assert.ok(toolNames.includes("open_incident"), "Deve incluir open_incident");
    assert.ok(toolNames.includes("resolve_incident"), "Deve incluir resolve_incident");
    assert.ok(toolNames.includes("list_incidents"), "Deve incluir list_incidents");
    assert.equal(toolNames.length, 4, "Deve expor 4 tools operacionais");

    const openTool = toolsResult.tools.find((t) => t.name === "open_incident");
    assert.ok(openTool?.description?.includes("OpsPilot"));

    await client.close();
    await server.close();
  });

  test("US2 [P2]: Executa ferramentas operacionais (tools/call) refletindo no OpsStore", async () => {
    const server = createOpsPilotMcpServer(store);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    // 1. Invocar list_alerts
    function getFirstText(res: any): string {
      assert.ok(Array.isArray(res.content));
      const first = res.content[0] as { type: string; text: string };
      assert.equal(first.type, "text");
      return first.text;
    }

    // 1. Invocar list_alerts
    const listRes = await client.callTool({
      name: "list_alerts",
      arguments: { status: "firing" },
    });
    const alerts = JSON.parse(getFirstText(listRes));
    assert.ok(Array.isArray(alerts));
    assert.equal(alerts.length, 3);
    assert.ok(alerts.every((a: any) => a.status === "firing"));

    // 2. Invocar open_incident com service
    const openRes = await client.callTool({
      name: "open_incident",
      arguments: {
        title: "Instabilidade na API de pagamentos",
        service: "payment-gateway",
        severity: "critical",
      },
    });
    const created = JSON.parse(getFirstText(openRes));
    assert.ok(created.id.startsWith("inc-"));
    assert.equal(created.service, "payment-gateway");
    assert.equal(created.status, "open");

    // Verificar persistência no store
    const openInStore = store.listIncidents("open");
    assert.ok(openInStore.some((i) => i.id === created.id));

    // 3. Invocar open_incident com service_id (compatibilidade com exemplo)
    const openWithServiceId = await client.callTool({
      name: "open_incident",
      arguments: {
        title: "Lentidão no Checkout",
        service_id: "checkout",
        severity: "medium",
      },
    });
    const created2 = JSON.parse(getFirstText(openWithServiceId));
    assert.equal(created2.service, "checkout");

    // 4. Invocar resolve_incident
    const resolveRes = await client.callTool({
      name: "resolve_incident",
      arguments: {
        id: created.id,
        summary: "Falha mitigada via rota alternativa",
      },
    });
    const resolved = JSON.parse(getFirstText(resolveRes));
    assert.equal(resolved.id, created.id);
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.summary, "Falha mitigada via rota alternativa");

    // 5. Invocar resolve_incident com ID inexistente
    const notFoundRes = await client.callTool({
      name: "resolve_incident",
      arguments: {
        id: "inc-fantasma-999",
      },
    });
    assert.equal(notFoundRes.isError, true);
    assert.match(
      getFirstText(notFoundRes),
      /Erro ao resolver incidente/
    );

    await client.close();
    await server.close();
  });

  test("US3 [P3]: Garante que nenhum console.log polui stdout e erros vão para stderr", async () => {
    let stdoutLogs = 0;
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      stdoutLogs++;
      originalLog(...args);
    };

    try {
      const server = createOpsPilotMcpServer(store);
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await server.connect(serverTransport);
      const client = new Client({ name: "test-client", version: "1.0.0" });
      await client.connect(clientTransport);

      await client.listTools();
      await client.callTool({
        name: "list_alerts",
        arguments: { status: "all" },
      });

      // Validar que NENHUM console.log foi emitido durante as operações do servidor
      assert.equal(stdoutLogs, 0, "Nenhum console.log deve ser disparado");

      await client.close();
      await server.close();
    } finally {
      console.log = originalLog;
    }
  });
});
