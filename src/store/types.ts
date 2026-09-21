import {
  Service,
  Alert,
  Incident,
  Runbook,
  AlertFilterStatus,
  IncidentFilter,
  IncidentFilterStatus,
  Severity,
} from "../schemas/entities.js";

export interface SeedResult {
  servicesCount: number;
  alertsCount: number;
  firingCount: number;
  resolvedCount: number;
  runbooksCount: number;
}

export interface OpsStore {
  seed(): SeedResult;
  resetStore(): void;
  listServices(): Service[];
  listAlerts(status?: AlertFilterStatus | string): Alert[];
  getAlertById(id: string): Alert | undefined;
  openIncident(title: string, service: string, severity: Severity): Incident;
  resolveIncident(id: string, summary?: string): Incident;
  listIncidents(status?: IncidentFilter | IncidentFilterStatus | string): Incident[];
  getIncidentById(id: string): Incident | undefined;
  getRunbookByService(service: string): Runbook | undefined;
  listRunbooks?(): Runbook[];
}
