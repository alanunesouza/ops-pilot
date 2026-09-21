import { z } from "zod";
import { SeveritySchema } from "./entities.js";

export const ListAlertsInputShape = {
  status: z
    .enum(["firing", "resolved", "all"])
    .default("firing")
    .describe(
      "Filtro do estado do alerta: 'firing' para alertas ativos no plantão, 'resolved' para alertas normalizados, ou 'all' para todos."
    ),
};
export const ListAlertsInputSchema = z.object(ListAlertsInputShape);
export type ListAlertsInput = z.infer<typeof ListAlertsInputSchema>;

export const OpenIncidentInputShape = {
  title: z
    .string()
    .min(1)
    .describe("Título descritivo e conciso do incidente operacional."),
  service: z
    .string()
    .min(1)
    .describe(
      "Identificador do serviço impactado (ex.: 'payment-gateway', 'auth-service', 'order-api')."
    ),
  severity: SeveritySchema.describe(
    "Nível de severidade operacional do incidente ('low', 'medium', 'high', 'critical')."
  ),
};
export const OpenIncidentInputSchema = z.object(OpenIncidentInputShape);
export type OpenIncidentInput = z.infer<typeof OpenIncidentInputSchema>;

export const ResolveIncidentInputShape = {
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
};
export const ResolveIncidentInputSchema = z.object(ResolveIncidentInputShape);
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentInputSchema>;

export const ListIncidentsInputShape = {
  status: z
    .enum(["open", "resolved", "all"])
    .default("open")
    .describe(
      "Filtro por status do incidente: 'open' para pendentes de mitigação, 'resolved' para encerrados, ou 'all' para todos."
    ),
};
export const ListIncidentsInputSchema = z.object(ListIncidentsInputShape);
export type ListIncidentsInput = z.infer<typeof ListIncidentsInputSchema>;
