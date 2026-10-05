import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { store } from "./ops-store.js";
import { fetchProviderStatus } from "./provider-status-client.js";
import { ProviderEnumSchema, ProviderName } from "../schemas/provider-status.js";
import {
  ListAlertsInputSchema,
  OpenIncidentInputSchema,
  ResolveIncidentInputSchema,
} from "../schemas/tools.js";

export const listAlerts = tool(
  async ({ status }) => JSON.stringify(store.listAlerts(status)),
  {
    name: "list_alerts",
    description:
      "Consulta e lista alertas de monitoramento da infraestrutura e serviços. Use quando o operador perguntar sobre o estado do plantão, alertas ativos/disparando, ou histórico recente de alertas resolvidos. NÃO use para listar incidentes abertos (use 'list_incidents') nem para consultar procedimentos operacionais (use 'consultar_runbook').",
    schema: ListAlertsInputSchema,
  }
);

export const openIncident = tool(
  async ({ title, service, severity }) => {
    try {
      const incident = store.openIncident(title, service, severity);
      return JSON.stringify(incident);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Erro ao abrir incidente: ${msg}`;
    }
  },
  {
    name: "open_incident",
    description:
      "Abre formalmente um novo incidente operacional em produção para um serviço impactado. Use quando houver um problema ativo, alerta crítico confirmado que exige intervenção humana, ou solicitação explícita do operador para abrir chamado. NÃO use para consultar incidentes abertos (use 'list_incidents'), para alertas já resolvidos, ou quando houver apenas dúvidas sem impacto real.",
    schema: OpenIncidentInputSchema,
  }
);

export const resolveIncident = tool(
  async ({ id, summary }) => {
    try {
      const incident = store.resolveIncident(id, summary);
      return JSON.stringify(incident);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Erro ao resolver incidente: ${msg}`;
    }
  },
  {
    name: "resolve_incident",
    description:
      "Marca um incidente operacional previamente aberto como resolvido após aplicação de ação corretiva. Use quando o problema reportado tiver sido mitigado e o plantão puder dar baixa na ocorrência. NÃO use se o serviço continuar apresentando instabilidade ou se o incidente ainda não foi aberto (use 'open_incident').",
    schema: ResolveIncidentInputSchema,
  }
);

export const listIncidents = tool(
  async ({ status }) => JSON.stringify(store.listIncidents(status)),
  {
    name: "list_incidents",
    description:
      "Lista os incidentes operacionais registrados no sistema com filtro por status. Use quando o operador perguntar quais incidentes estão em andamento, abertos, ou histórico de incidentes já resolvidos. NÃO use para inspecionar alertas de telemetria brutos (use 'list_alerts') nem para consultar procedimentos de remediação (use 'consultar_runbook').",
    schema: z.object({
      status: z
        .enum(["open", "resolved", "all"])
        .default("open")
        .describe(
          "Filtro por status do incidente: 'open' para pendentes de mitigação, 'resolved' para encerrados, ou 'all' para todos."
        ),
    }),
  }
);

export const consultarRunbook = tool(
  async ({ service }) => {
    const runbook = store.getRunbookByService(service);
    if (!runbook) {
      return `Nenhum runbook operacional encontrado para o serviço "${service}".`;
    }
    return `### ${runbook.title}\n\n${runbook.content}`;
  },
  {
    name: "consultar_runbook",
    description:
      "Recupera o guia operacional padrão (runbook) contendo diagnóstico e passos recomendados de remediação para um serviço específico. Use quando identificar um alerta ou incidente em um serviço e precisar do procedimento técnico para mitigação. NÃO use para checar status de alertas (use 'list_alerts') nem para registrar incidentes (use 'open_incident').",
    schema: z.object({
      service: z
        .string()
        .min(1)
        .describe(
          "Nome do serviço a consultar o runbook (ex.: 'checkout', 'payments', 'payment-gateway', 'auth-service')."
        ),
    }),
  }
);

import { getMemoryStore, MemoryStore } from "../memory/index.js";

export function createCheckProviderStatusTool(doFetch: typeof fetch = fetch) {
  return tool(
    async ({ provider }) => {
      return fetchProviderStatus(provider, doFetch);
    },
    {
      name: "check_provider_status",
      description:
        "Consulta a statuspage pública oficial de provedores externos essenciais (GitHub e Cloudflare) via API statuspage.io sem necessidade de chave de autenticação. Use quando houver suspeita de que uma instabilidade, lentidão ou queda reportada no plantão é decorrente de degradação em um provedor externo ('é nosso ou do provedor?'), ou quando uma dependência externa parecer fora do ar. NÃO use para verificar alertas ou métricas de serviços internos da nossa própria infraestrutura (use 'list_alerts'), para consultar incidentes abertos (use 'list_incidents') nem para procedimentos de remediação interna (use 'consultar_runbook').",
      schema: z.object({
        provider: ProviderEnumSchema.default("github").describe(
          "Identificador do provedor externo a consultar: 'github' para status do ecossistema GitHub ou 'cloudflare' para rede e edge da Cloudflare. Padrão: 'github'."
        ),
      }),
    }
  );
}

export const checkProviderStatus = createCheckProviderStatusTool();

export function createForgetPreferenceTool(
  customMemoryStore?: MemoryStore,
  getUserId?: () => string | undefined
) {
  return tool(
    async ({ preference, userId }) => {
      const activeUserId = userId ?? getUserId?.() ?? "default-user";
      const store = customMemoryStore ?? getMemoryStore();

      const memories = await store.recall(activeUserId, preference, 1);
      if (!memories || memories.length === 0) {
        return `Nenhuma preferência correspondente a "${preference}" foi encontrada para exclusão.`;
      }

      const target = memories[0];
      await store.forget(activeUserId, target.id);
      return `A preferência "${target.fact}" foi removida com sucesso da sua memória.`;
    },
    {
      name: "forget_preference",
      description:
        "Remove ou revoga uma preferência ou fato durável previamente aprendido sobre o operador. Use quando o operador solicitar explicitamente para esquecer, desconsiderar ou remover uma preferência, procedimento favorito ou regra de trabalho que havia sido ensinada anteriormente. NÃO use para registrar novas preferências (o sistema aprende automaticamente), para resolver incidentes (use 'resolve_incident') nem para apagar alertas do sistema.",
      schema: z.object({
        preference: z
          .string()
          .trim()
          .min(1)
          .describe("Descrição em linguagem natural ou palavra-chave da preferência que o operador deseja esquecer."),
        userId: z
          .string()
          .trim()
          .optional()
          .describe("Identificador do operador (opcional, padrão do contexto atual)."),
      }),
    }
  );
}

export const forgetPreference = createForgetPreferenceTool();

export const opsTools = [
  listAlerts,
  openIncident,
  resolveIncident,
  listIncidents,
  consultarRunbook,
  checkProviderStatus,
  forgetPreference,
];

