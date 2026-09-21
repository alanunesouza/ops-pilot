import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import type { OpsStore } from "../store/types.js";
import { getOpsStore } from "../agents/ops-store.js";

/**
 * Cria e configura a instância do servidor MCP oficial do OpsPilot.
 * Permite injeção de uma instância customizada de OpsStore (ex.: em memória para testes).
 */
export function createOpsPilotMcpServer(customStore?: OpsStore): McpServer {
  const store = customStore ?? getOpsStore();

  const server = new McpServer({
    name: "opspilot",
    version: "1.0.0",
  });

  // 1. Tool: list_alerts
  server.registerTool(
    "list_alerts",
    {
      description:
        "Consulta e lista alertas de monitoramento da infraestrutura e serviços. Use quando o operador perguntar sobre o estado do plantão, alertas ativos/disparando, ou histórico recente de alertas resolvidos.",
      inputSchema: {
        status: z
          .enum(["firing", "resolved", "all"])
          .default("firing")
          .describe(
            "Filtro do estado do alerta: 'firing' para alertas ativos no plantão, 'resolved' para alertas normalizados, ou 'all' para todos."
          ),
      },
    },
    async ({ status }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(store.listAlerts(status)),
        },
      ],
    })
  );

  // 2. Tool: open_incident
  server.registerTool(
    "open_incident",
    {
      description:
        "Abre um novo incidente no OpsPilot. Use quando o usuário relatar um problema em produção ou pedir para registar/abrir um incidente.",
      inputSchema: {
        title: z.string().min(1).describe("Título curto do incidente."),
        service: z
          .string()
          .optional()
          .describe(
            "Identificador do serviço impactado (ex.: 'payment-gateway', 'auth-service', 'order-api')."
          ),
        service_id: z
          .string()
          .optional()
          .describe("serviço afetado (ex: checkout, payments)"),
        severity: z
          .enum(["low", "medium", "high", "critical"])
          .describe("severidade do incidente"),
      },
    },
    async ({ title, service, service_id, severity }) => {
      const targetService = service || service_id;
      if (!targetService) {
        throw new Error("O campo 'service' (ou 'service_id') é obrigatório.");
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(store.openIncident(title, targetService, severity)),
          },
        ],
      };
    }
  );

  // 3. Tool: resolve_incident
  server.registerTool(
    "resolve_incident",
    {
      description:
        "Marca um incidente operacional previamente aberto como resolvido após aplicação de ação corretiva. Use quando o problema reportado tiver sido mitigado e o plantão puder dar baixa na ocorrência.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("Identificador único do incidente a ser encerrado (ex.: 'inc-xxx')."),
        summary: z
          .string()
          .optional()
          .describe(
            "Resumo ou justificativa opcional descrevendo a ação corretiva aplicada para mitigação."
          ),
      },
    },
    async ({ id, summary }) => {
      try {
        const resolved = store.resolveIncident(id, summary);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(resolved),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: `Erro ao resolver incidente: ${msg}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 4. Tool: list_incidents
  server.registerTool(
    "list_incidents",
    {
      description:
        "Lista os incidentes operacionais registrados no sistema com filtro por status. Use para verificar incidentes abertos, resolvidos ou histórico completo.",
      inputSchema: {
        status: z
          .enum(["open", "resolved", "all"])
          .default("open")
          .describe(
            "Filtro por status do incidente: 'open' para pendentes de mitigação, 'resolved' para encerrados, ou 'all' para todos."
          ),
      },
    },
    async ({ status }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(store.listIncidents(status)),
        },
      ],
    })
  );

  return server;
}

/**
 * Ponto de entrada executável para inicialização do servidor sobre stdio.
 */
export async function runServer(): Promise<void> {
  const storePathIndex = process.argv.indexOf("--store-path");
  const customDbPath =
    storePathIndex !== -1 && process.argv[storePathIndex + 1]
      ? process.argv[storePathIndex + 1]
      : undefined;
  const customStore = customDbPath ? new SqliteOpsStore(customDbPath) : undefined;

  const server = createOpsPilotMcpServer(customStore);
  await server.connect(new StdioServerTransport());
  console.error("opspilot MCP server: pronto (stdio)"); // stderr, nunca stdout
}

// Executa se o arquivo for chamado diretamente como script
if (
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"))
) {
  runServer().catch((err) => {
    console.error("Erro fatal no servidor MCP:", err);
    process.exit(1);
  });
}
