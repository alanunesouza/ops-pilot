import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SqliteOpsStore } from "./sqlite-ops-store.js";
import { IncidentNotFoundError } from "../utils/errors.js";

describe("SqliteOpsStore", () => {
  let store: SqliteOpsStore;

  beforeEach(() => {
    store = new SqliteOpsStore(":memory:");
  });

  describe("DDL & Inicialização", () => {
    it("deve inicializar o banco em memória e permitir instanciar sem erros", () => {
      assert.ok(store);
      assert.ok(store._db);
    });
  });

  describe("Seed Idempotente", () => {
    it("deve semear 5 serviços, 6 alertas (3 firing, 3 resolved) e 3 runbooks", () => {
      const result = store.seed();
      assert.equal(result.servicesCount, 5);
      assert.equal(result.alertsCount, 6);
      assert.equal(result.firingCount, 3);
      assert.equal(result.resolvedCount, 3);
      assert.equal(result.runbooksCount, 3);

      const services = store.listServices();
      assert.equal(services.length, 5);

      const firingAlerts = store.listAlerts("firing");
      assert.equal(firingAlerts.length, 3);

      const resolvedAlerts = store.listAlerts("resolved");
      assert.equal(resolvedAlerts.length, 3);

      const allAlerts = store.listAlerts("all");
      assert.equal(allAlerts.length, 6);
    });

    it("deve ser idempotente ao rodar seed() consecutivamente", () => {
      store.seed();
      const secondResult = store.seed();

      assert.equal(secondResult.servicesCount, 5);
      assert.equal(secondResult.alertsCount, 6);
      assert.equal(secondResult.runbooksCount, 3);

      assert.equal(store.listServices().length, 5);
      assert.equal(store.listAlerts("all").length, 6);
    });

    it("deve resetar o banco ao chamar resetStore()", () => {
      store.seed();
      store.openIncident("Incidente temporário", "auth-service", "high");
      assert.equal(store.listIncidents("all").length, 1);

      store.resetStore();
      assert.equal(store.listIncidents("all").length, 0);
      assert.equal(store.listServices().length, 5);
    });
  });

  describe("Ciclo de Vida de Incidentes", () => {
    beforeEach(() => {
      store.seed();
    });

    it("deve abrir um incidente com status open e timestamps corretos", () => {
      const incident = store.openIncident(
        "Queda no gateway de pagamentos",
        "payment-gateway",
        "critical"
      );

      assert.ok(incident.id.startsWith("inc-"));
      assert.equal(incident.title, "Queda no gateway de pagamentos");
      assert.equal(incident.service, "payment-gateway");
      assert.equal(incident.severity, "critical");
      assert.equal(incident.status, "open");
      assert.ok(incident.createdAt || incident.created_at);

      const retrieved = store.getIncidentById(incident.id);
      assert.ok(retrieved);
      assert.equal(retrieved.id, incident.id);
      assert.equal(retrieved.status, "open");
    });

    it("deve resolver um incidente aberto preenchendo resolvedAt e summary", () => {
      const incident = store.openIncident(
        "Instabilidade no token",
        "auth-service",
        "high"
      );

      const resolved = store.resolveIncident(
        incident.id,
        "Chaves JWKS recicladas e pods escalados"
      );

      assert.equal(resolved.status, "resolved");
      assert.ok(resolved.resolvedAt || resolved.resolved_at);
      assert.equal(resolved.summary, "Chaves JWKS recicladas e pods escalados");

      const retrieved = store.getIncidentById(incident.id);
      assert.ok(retrieved);
      assert.equal(retrieved.status, "resolved");
      assert.equal(retrieved.summary, "Chaves JWKS recicladas e pods escalados");
    });

    it("deve lançar IncidentNotFoundError ao tentar resolver incidente inexistente", () => {
      assert.throws(
        () => store.resolveIncident("inc-inexistente", "Tentativa"),
        (err) => err instanceof IncidentNotFoundError
      );
    });

    it("deve filtrar incidentes corretamente (open, resolved, all)", () => {
      const inc1 = store.openIncident("Inc 1", "order-api", "medium");
      const inc2 = store.openIncident("Inc 2", "auth-service", "low");

      assert.equal(store.listIncidents("open").length, 2);
      assert.equal(store.listIncidents().length, 2); // default open
      assert.equal(store.listIncidents("resolved").length, 0);
      assert.equal(store.listIncidents("all").length, 2);

      store.resolveIncident(inc1.id, "Resolvido");

      assert.equal(store.listIncidents("open").length, 1);
      assert.equal(store.listIncidents("resolved").length, 1);
      assert.equal(store.listIncidents("all").length, 2);
    });
  });

  describe("Restrições CHECK do Banco de Dados", () => {
    it("deve rejeitar severidade inválida no incidente com erro de CHECK constraint", () => {
      assert.throws(() => {
        // @ts-expect-error teste de valor ilegal
        store.openIncident("Título", "serviço", "severidade-invalida");
      }, /CHECK constraint failed/);
    });

    it("deve rejeitar tier inválido no serviço com erro de CHECK constraint", () => {
      assert.throws(() => {
        const stmt = store._db.prepare(
          "INSERT INTO services (id, name, description, tier) VALUES (?, ?, ?, ?)"
        );
        stmt.run("srv-x", "svc-invalid", "desc", "tier-99");
      }, /CHECK constraint failed/);
    });
  });

  describe("Prepared Statements e Segurança SQL", () => {
    it("deve tratar caracteres maliciosos de SQL Injection sem quebrar a query", () => {
      store.seed();
      const maliciousTitle = "Normal'; DROP TABLE incidents; --";
      const incident = store.openIncident(maliciousTitle, "order-api", "low");

      assert.equal(incident.title, maliciousTitle);
      const retrieved = store.getIncidentById(incident.id);
      assert.ok(retrieved);
      assert.equal(retrieved.title, maliciousTitle);

      // Tabela continua intacta
      assert.ok(store.listIncidents("all").length > 0);
    });
  });

  describe("Consulta a Runbooks", () => {
    beforeEach(() => {
      store.seed();
    });

    it("deve consultar runbook por serviço para checkout, payments e auth", () => {
      const rbPayments = store.getRunbookByService("payments");
      assert.ok(rbPayments);
      assert.match(rbPayments.title, /Gateway de Pagamentos|Payments/i);

      const rbCheckout = store.getRunbookByService("checkout");
      assert.ok(rbCheckout);
      assert.match(rbCheckout.title, /Checkout|Pedidos/i);

      const rbAuth = store.getRunbookByService("auth");
      assert.ok(rbAuth);
      assert.match(rbAuth.title, /Autentica|JWT|Auth/i);
    });

    it("deve retornar undefined ao buscar runbook para serviço inexistente", () => {
      const rbInexistente = store.getRunbookByService("servico-fantasma");
      assert.equal(rbInexistente, undefined);
    });
  });
});
