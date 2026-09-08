import {
  Service,
  Alert,
  Incident,
  AlertFilterStatus,
  Severity,
  ServiceSchema,
  AlertSchema,
  IncidentSchema,
} from "../schemas/entities.js";

export const initialServices: Service[] = [
  {
    id: "srv-auth",
    name: "auth-service",
    description: "Autenticação centralizada e gestão de sessões/JWT",
    tier: "tier-1",
  },
  {
    id: "srv-payment",
    name: "payment-gateway",
    description: "Gateway de pagamentos, cobrança e checkout",
    tier: "tier-1",
  },
  {
    id: "srv-order",
    name: "order-api",
    description: "Processamento de pedidos e ciclo de vendas",
    tier: "tier-1",
  },
  {
    id: "srv-inventory",
    name: "inventory-service",
    description: "Controle de estoque e disponibilidade de catálogo",
    tier: "tier-2",
  },
  {
    id: "srv-notification",
    name: "notification-hub",
    description: "Disparo assíncrono de e-mails, SMS e push notifications",
    tier: "tier-3",
  },
];

export const initialAlerts: Alert[] = [
  {
    id: "alt-001",
    service: "payment-gateway",
    title: "High error rate (5xx) in checkout transactions",
    severity: "critical",
    status: "firing",
    timestamp: "2026-09-06T14:30:00.000Z",
  },
  {
    id: "alt-002",
    service: "order-api",
    title: "Database connection pool exhaustion",
    severity: "high",
    status: "firing",
    timestamp: "2026-09-06T14:45:00.000Z",
  },
  {
    id: "alt-003",
    service: "auth-service",
    title: "Elevated p99 latency in token validation",
    severity: "medium",
    status: "firing",
    timestamp: "2026-09-06T14:50:00.000Z",
  },
  {
    id: "alt-004",
    service: "notification-hub",
    title: "Email dispatch queue lag above threshold",
    severity: "low",
    status: "resolved",
    timestamp: "2026-09-06T13:00:00.000Z",
  },
  {
    id: "alt-005",
    service: "inventory-service",
    title: "Memory spike during stock recalculation",
    severity: "medium",
    status: "resolved",
    timestamp: "2026-09-06T13:15:00.000Z",
  },
  {
    id: "alt-006",
    service: "auth-service",
    title: "Failed login attempt threshold exceeded",
    severity: "high",
    status: "resolved",
    timestamp: "2026-09-06T13:30:00.000Z",
  },
];

export class InMemoryStore {
  private services: Map<string, Service> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private incidents: Map<string, Incident> = new Map();

  constructor() {
    this.seed();
  }

  public seed(): { servicesCount: number; alertsCount: number; firingCount: number; resolvedCount: number } {
    this.services.clear();
    this.alerts.clear();
    this.incidents.clear();

    for (const s of initialServices) {
      const validated = ServiceSchema.parse(s);
      this.services.set(validated.id, validated);
    }

    for (const a of initialAlerts) {
      const validated = AlertSchema.parse(a);
      this.alerts.set(validated.id, validated);
    }

    const alertsList = Array.from(this.alerts.values());
    const firingCount = alertsList.filter((a) => a.status === "firing").length;
    const resolvedCount = alertsList.filter((a) => a.status === "resolved").length;

    return {
      servicesCount: this.services.size,
      alertsCount: this.alerts.size,
      firingCount,
      resolvedCount,
    };
  }

  public resetStore(): void {
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
      updatedAt: now,
    });

    this.incidents.set(incident.id, incident);
    return incident;
  }

  public resolveIncident(id: string): Incident {
    const existing = this.incidents.get(id);
    if (!existing) {
      throw new Error(`Incident with id "${id}" not found.`);
    }

    const updated: Incident = IncidentSchema.parse({
      ...existing,
      status: "resolved",
      updatedAt: new Date().toISOString(),
    });

    this.incidents.set(id, updated);
    return updated;
  }

  public listIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }
}

export const memoryStore = new InMemoryStore();
export const store = memoryStore;
