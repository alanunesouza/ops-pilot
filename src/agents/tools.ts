import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { store } from "./ops-store.js";

export const listAlerts = tool(
  async ({ status }) => JSON.stringify(store.listAlerts(status)),
  {
    name: "list_alerts",
    description:
      "Lista os alertas de monitoramento. Use quando o plantonista perguntar o que está disparando, o estado dos serviços ou 'como está o plantão' status: firing | resolved | all",
    schema: z.object({
      status: z.enum(["firing", "resolved", "all"]).default("firing"),
    }),
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
      "Abre formalmente um incidente operacional associado a um serviço e severidade (low, medium, high, critical)",
    schema: z.object({
      title: z.string().min(1).describe("Título descritivo do incidente"),
      service: z.string().min(1).describe("Nome do serviço impactado"),
      severity: z
        .enum(["low", "medium", "high", "critical"])
        .describe("Nível de severidade operacional"),
    }),
  }
);

export const resolveIncident = tool(
  async ({ id }) => {
    try {
      const incident = store.resolveIncident(id);
      return JSON.stringify(incident);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Erro ao resolver incidente: ${msg}`;
    }
  },
  {
    name: "resolve_incident",
    description: "Resolve um incidente operacional previamente aberto dado o seu ID",
    schema: z.object({
      id: z.string().min(1).describe("ID do incidente a ser resolvido"),
    }),
  }
);

export const opsTools = [listAlerts, openIncident, resolveIncident];
