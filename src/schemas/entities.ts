import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const AlertStatusSchema = z.enum(["firing", "resolved"]);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;

export const AlertFilterStatusSchema = z.enum(["firing", "resolved", "all"]);
export type AlertFilterStatus = z.infer<typeof AlertFilterStatusSchema>;

export const IncidentStatusSchema = z.enum(["open", "resolved"]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const ServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tier: z.enum(["tier-1", "tier-2", "tier-3"]).default("tier-2"),
});
export type Service = z.infer<typeof ServiceSchema>;

export const AlertSchema = z.object({
  id: z.string().min(1),
  service: z.string().min(1),
  title: z.string().min(1),
  severity: SeveritySchema,
  status: AlertStatusSchema,
  timestamp: z.string().datetime().or(z.string()),
});
export type Alert = z.infer<typeof AlertSchema>;

export const IncidentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  service: z.string().min(1),
  severity: SeveritySchema,
  status: IncidentStatusSchema,
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});
export type Incident = z.infer<typeof IncidentSchema>;
