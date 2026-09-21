# Contract: Interface Unificada `OpsStore`

**Feature**: `004-sqlite-ops-persistence`
**Date**: 2026-09-20
**Status**: Completed

## 1. Interface TypeScript (`src/store/types.ts`)

```typescript
import {
  Service,
  Alert,
  Incident,
  Runbook,
  AlertFilterStatus,
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
  /**
   * Executa a carga inicial idempotente de serviços, alertas e runbooks.
   */
  seed(): SeedResult;

  /**
   * Reseta o repositório para o estado inicial da semente.
   */
  resetStore(): void;

  /**
   * Lista todos os serviços registrados no catálogo.
   */
  listServices(): Service[];

  /**
   * Lista alertas filtrados por status ("firing", "resolved" ou "all").
   */
  listAlerts(status?: AlertFilterStatus | string): Alert[];

  /**
   * Busca um alerta pelo seu identificador único.
   */
  getAlertById(id: string): Alert | undefined;

  /**
   * Abre formalmente um novo incidente operacional.
   */
  openIncident(title: string, service: string, severity: Severity): Incident;

  /**
   * Resolve um incidente existente, opcionalmente anexando resumo de fechamento.
   * Lança erro de domínio se o ID não for encontrado.
   */
  resolveIncident(id: string, summary?: string): Incident;

  /**
   * Lista incidentes com filtro por status ("open", "resolved" ou "all"). Padrão: "open".
   */
  listIncidents(status?: IncidentFilterStatus | string): Incident[];

  /**
   * Busca um incidente específico pelo seu identificador.
   */
  getIncidentById(id: string): Incident | undefined;

  /**
   * Consulta o runbook operacional associado a um serviço específico.
   */
  getRunbookByService(service: string): Runbook | undefined;

  /**
   * Lista todos os runbooks operacionais cadastrados.
   */
  listRunbooks?(): Runbook[];
}
```

---

## 2. Erros de Domínio Vinculados (`src/utils/errors.ts`)

Conforme Princípio III da Constitution (*Erros são de Domínio*):

```typescript
export class IncidentNotFoundError extends Error {
  constructor(public readonly incidentId: string) {
    super(`Incidente com ID "${incidentId}" não foi encontrado.`);
    this.name = "IncidentNotFoundError";
  }
}

export class RunbookNotFoundError extends Error {
  constructor(public readonly service: string) {
    super(`Runbook para o serviço "${service}" não foi encontrado.`);
    this.name = "RunbookNotFoundError";
  }
}
```
