import {
  Service,
  Alert,
  Incident,
  Runbook,
  AlertFilterStatus,
  IncidentFilter,
  IncidentFilterStatus,
  Severity,
  ServiceSchema,
  AlertSchema,
  IncidentSchema,
  RunbookSchema,
} from "../schemas/entities.js";
import type { OpsStore, SeedResult } from "./types.js";
import { initialServices, initialAlerts, initialRunbooks } from "./sqlite-ops-store.js";
import { IncidentNotFoundError } from "../utils/errors.js";

export { initialServices, initialAlerts, initialRunbooks };

export class InMemoryStore implements OpsStore {
  private services: Map<string, Service> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private runbooks: Map<string, Runbook> = new Map();

  constructor() {
    this.seed();
  }

  public seed(): SeedResult {
    this.services.clear();
    this.alerts.clear();
    this.incidents.clear();
    this.runbooks.clear();

    for (const s of initialServices) {
      const validated = ServiceSchema.parse(s);
      this.services.set(validated.id, validated);
    }

    for (const a of initialAlerts) {
      const validated = AlertSchema.parse(a);
      this.alerts.set(validated.id, validated);
    }

    for (const rb of initialRunbooks) {
      const validated = RunbookSchema.parse(rb);
      this.runbooks.set(validated.id, validated);
    }

    const alertsList = Array.from(this.alerts.values());
    const firingCount = alertsList.filter((a) => a.status === "firing").length;
    const resolvedCount = alertsList.filter((a) => a.status === "resolved").length;

    return {
      servicesCount: this.services.size,
      alertsCount: this.alerts.size,
      firingCount,
      resolvedCount,
      runbooksCount: this.runbooks.size,
    };
  }

  public resetStore(): void {
    this.incidents.clear();
    this.seed();
  }

  public listServices(): Service[] {
    return Array.from(this.services.values());
  }

  public listAlerts(status?: AlertFilterStatus | string): Alert[] {
    const list = Array.from(this.alerts.values());
    if (!status || status === "all") return list;
    return list.filter((alert) => alert.status === status);
  }

  public getAlertById(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  public openIncident(title: string, service: string, severity: Severity): Incident {
    const id = `inc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const incident: Incident = IncidentSchema.parse({
      id,
      title,
      service,
      severity,
      status: "open",
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
      resolvedAt: null,
      resolved_at: null,
      summary: null,
    });

    this.incidents.set(incident.id, incident);
    return incident;
  }

  public resolveIncident(id: string, summary?: string): Incident {
    const existing = this.incidents.get(id);
    if (!existing) {
      throw new IncidentNotFoundError(id);
    }

    const now = new Date().toISOString();
    const updated: Incident = IncidentSchema.parse({
      ...existing,
      status: "resolved",
      updatedAt: now,
      updated_at: now,
      resolvedAt: now,
      resolved_at: now,
      summary: summary ?? existing.summary ?? null,
    });

    this.incidents.set(id, updated);
    return updated;
  }

  public listIncidents(filter?: IncidentFilter | IncidentFilterStatus | string): Incident[] {
    const list = Array.from(this.incidents.values());
    if (!filter || filter === "all") return list;
    return list.filter((inc) => inc.status === filter);
  }

  public getIncidentById(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  public getRunbookByService(service: string): Runbook | undefined {
    const raw = service.trim().toLowerCase();
    const stemmed = raw.replace(/s$/, "");
    for (const rb of this.runbooks.values()) {
      const s = rb.service.toLowerCase();
      const t = rb.title.toLowerCase();
      if (
        s === raw ||
        s === stemmed ||
        s.includes(raw) ||
        s.includes(stemmed) ||
        raw.includes(s) ||
        t.includes(raw)
      ) {
        return rb;
      }
    }
    return undefined;
  }

  public listRunbooks(): Runbook[] {
    return Array.from(this.runbooks.values());
  }
}

export const memoryStore = new InMemoryStore();
export const store = memoryStore;
