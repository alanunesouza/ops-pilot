import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  Service,
  Alert,
  Incident,
  Runbook,
  AlertFilterStatus,
  IncidentFilter,
  IncidentFilterStatus,
  Severity,
} from "../schemas/entities.js";
import type { OpsStore, SeedResult } from "./types.js";
import { IncidentNotFoundError } from "../utils/errors.js";

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

export const initialRunbooks: Runbook[] = [
  {
    id: "rb-payments",
    service: "payment-gateway",
    title: "Runbook: Erros 5xx e Latência no Gateway de Pagamentos",
    content: `# Runbook - payment-gateway (payments)
## 1. Sintomas Comuns
- Disparo de alertas 5xx nas rotas de checkout.
- Falha na comunicação com a adquirente externa.

## 2. Diagnóstico
1. Inspecione a latência e taxa de erro da adquirente externa no dashboard.
2. Verifique se o circuit-breaker do gateway abriu (métricas Prometheus).

## 3. Mitigação
1. Alterne para a rota de adquirência redundante caso o erro seja da adquirente primária.
2. Efetue flush do circuit breaker após restabelecimento.
3. Se o incidente persistir, notifique a equipe de meios de pagamento.`,
  },
  {
    id: "rb-checkout",
    service: "order-api",
    title: "Runbook: Esgotamento de Pool e Falha de Checkout",
    content: `# Runbook - order-api (checkout)
## 1. Sintomas Comuns
- Erros de timeout ao finalizar pedidos.
- Connection pool exhaustion no banco relacional.

## 2. Diagnóstico
1. Verifique queries lentas e bloqueios de lock na tabela de pedidos.
2. Verifique o número de conexões ativas no pool de banco da order-api.

## 3. Mitigação
1. Mate queries zumbis ou com tempo de execução superior a 30s.
2. Escale horizontalmente os pods de order-api se o tráfego for legítimo.
3. Abra chamado formal se houver corrupção de transações.`,
  },
  {
    id: "rb-auth",
    service: "auth-service",
    title: "Runbook: Latência Elevada e Validação de Tokens JWT",
    content: `# Runbook - auth-service (auth)
## 1. Sintomas Comuns
- P99 de latência acima de 500ms na validação de tokens JWT.
- Picos de tentativas de login inválido.

## 2. Diagnóstico
1. Inspecione o hit-rate do cluster Redis de cache de sessões.
2. Verifique a carga de CPU dos nós de auth e a integridade das chaves JWKS.

## 3. Mitigação
1. Reinicie ou aumente réplicas do cache Redis caso haja degradação.
2. Force a rotação/recarga das chaves JWKS em caso de falha de assinatura.
3. Se detectado ataque de força bruta, habilite rate-limiting agressivo na borda.`,
  },
];

export class SqliteOpsStore implements OpsStore {
  _db: DatabaseSync;

  constructor(pathStr: string = process.env.OPSPILOT_DB ?? "./data/opspilot.db") {
    if (pathStr !== ":memory:") {
      const dir = path.dirname(pathStr);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this._db = new DatabaseSync(pathStr);

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        tier TEXT NOT NULL CHECK (tier IN ('tier-1', 'tier-2', 'tier-3'))
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL,
        title TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical', 'sev1', 'sev2', 'sev3')),
        status TEXT NOT NULL CHECK (status IN ('firing', 'resolved')),
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        service TEXT NOT NULL,
        service_id TEXT GENERATED ALWAYS AS (service) VIRTUAL,
        severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical', 'sev1', 'sev2', 'sev3')),
        status TEXT NOT NULL CHECK (status IN ('open', 'mitigated', 'resolved')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt TEXT GENERATED ALWAYS AS (created_at) VIRTUAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT GENERATED ALWAYS AS (updated_at) VIRTUAL,
        resolved_at DATETIME,
        resolvedAt TEXT GENERATED ALWAYS AS (resolved_at) VIRTUAL,
        summary TEXT
      );

      CREATE TABLE IF NOT EXISTS runbooks (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt TEXT GENERATED ALWAYS AS (created_at) VIRTUAL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT GENERATED ALWAYS AS (updated_at) VIRTUAL
      );
    `);
  }

  public seed(): SeedResult {
    const insertService = this._db.prepare(`
      INSERT OR REPLACE INTO services (id, name, description, tier)
      VALUES (?, ?, ?, ?)
    `);

    for (const s of initialServices) {
      insertService.run(s.id, s.name, s.description ?? "", s.tier);
    }

    const insertAlert = this._db.prepare(`
      INSERT OR REPLACE INTO alerts (id, service, title, severity, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const a of initialAlerts) {
      insertAlert.run(a.id, a.service, a.title, a.severity, a.status, a.timestamp);
    }

    const insertRunbook = this._db.prepare(`
      INSERT OR REPLACE INTO runbooks (id, service, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    for (const rb of initialRunbooks) {
      insertRunbook.run(rb.id, rb.service, rb.title, rb.content);
    }

    const servicesCount = (this._db.prepare("SELECT COUNT(*) as count FROM services").get() as { count: number }).count;
    const alertsCount = (this._db.prepare("SELECT COUNT(*) as count FROM alerts").get() as { count: number }).count;
    const firingCount = (this._db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'firing'").get() as { count: number }).count;
    const resolvedCount = (this._db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'resolved'").get() as { count: number }).count;
    const runbooksCount = (this._db.prepare("SELECT COUNT(*) as count FROM runbooks").get() as { count: number }).count;

    return {
      servicesCount,
      alertsCount,
      firingCount,
      resolvedCount,
      runbooksCount,
    };
  }

  public resetStore(): void {
    this._db.exec("DELETE FROM incidents");
    this.seed();
  }

  public listServices(): Service[] {
    const stmt = this._db.prepare("SELECT id, name, description, tier FROM services ORDER BY id");
    return stmt.all() as unknown as Service[];
  }

  public listAlerts(status?: AlertFilterStatus | string): Alert[] {
    const filter = !status || status === "all" ? null : status;
    if (filter) {
      const stmt = this._db.prepare("SELECT id, service, title, severity, status, timestamp FROM alerts WHERE status = ? ORDER BY timestamp DESC");
      return stmt.all(filter) as unknown as Alert[];
    }
    const stmt = this._db.prepare("SELECT id, service, title, severity, status, timestamp FROM alerts ORDER BY timestamp DESC");
    return stmt.all() as unknown as Alert[];
  }

  public getAlertById(id: string): Alert | undefined {
    const stmt = this._db.prepare("SELECT id, service, title, severity, status, timestamp FROM alerts WHERE id = ?");
    return stmt.get(id) as unknown as Alert | undefined;
  }

  public openIncident(title: string, service: string, severity: Severity): Incident {
    const id = `inc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const stmt = this._db.prepare(`
      INSERT INTO incidents (id, title, service, severity, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?)
    `);

    stmt.run(id, title, service, severity, now, now);

    return this.getIncidentById(id)!;
  }

  public resolveIncident(id: string, summary?: string): Incident {
    const existing = this.getIncidentById(id);
    if (!existing) {
      throw new IncidentNotFoundError(id);
    }

    const now = new Date().toISOString();
    const finalSummary = summary ?? existing.summary ?? null;

    const stmt = this._db.prepare(`
      UPDATE incidents
      SET status = 'resolved', updated_at = ?, resolved_at = ?, summary = ?
      WHERE id = ?
    `);

    stmt.run(now, now, finalSummary, id);

    return this.getIncidentById(id)!;
  }

  public listIncidents(filter?: IncidentFilter | IncidentFilterStatus | string): Incident[] {
    const where = !filter || filter === "all" ? "" : `WHERE status = ?`;
    const stmt = this._db.prepare(`SELECT * FROM incidents ${where} ORDER BY created_at ASC`);
    return (!filter || filter === "all" ? stmt.all() : stmt.all(filter)) as unknown as Incident[];
  }

  public getIncidentById(id: string): Incident | undefined {
    const stmt = this._db.prepare("SELECT * FROM incidents WHERE id = ?");
    return stmt.get(id) as unknown as Incident | undefined;
  }

  public getRunbookByService(service: string): Runbook | undefined {
    const raw = service.trim().toLowerCase();
    const stemmed = raw.replace(/s$/, ""); // e.g. payments -> payment
    const stmt = this._db.prepare(`
      SELECT * FROM runbooks
      WHERE LOWER(service) = ?
         OR LOWER(service) = ?
         OR LOWER(service) LIKE '%' || ? || '%'
         OR LOWER(service) LIKE '%' || ? || '%'
         OR ? LIKE '%' || LOWER(service) || '%'
         OR LOWER(title) LIKE '%' || ? || '%'
      LIMIT 1
    `);
    return stmt.get(raw, stemmed, raw, stemmed, raw, raw) as unknown as Runbook | undefined;
  }

  public listRunbooks(): Runbook[] {
    const stmt = this._db.prepare("SELECT * FROM runbooks ORDER BY service");
    return stmt.all() as unknown as Runbook[];
  }
}
