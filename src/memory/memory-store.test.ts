import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SqliteMemoryStore } from "./memory-store.js";

describe("SqliteMemoryStore Unit Tests", () => {
  test("deve inicializar a tabela memories em modo :memory: sem erros", () => {
    const store = new SqliteMemoryStore(":memory:");
    assert.ok(store);
    assert.ok(store._db);
  });

  test("US1: remember deve persistir um novo fato com embedding BLOB", async () => {
    const store = new SqliteMemoryStore(":memory:");
    const res = await store.remember("usr-1", "O operador responsável pela equipe de pagamentos é o Alan.");

    assert.equal(res.inserted, true);
    assert.equal(res.reason, "created");
    assert.equal(res.memory.userId, "usr-1");
    assert.equal(res.memory.fact, "O operador responsável pela equipe de pagamentos é o Alan.");
    assert.ok(res.memory.id);
    assert.equal(res.memory.embedding.length, 384);

    const all = store._all("usr-1");
    assert.equal(all.length, 1);
    assert.equal(all[0].fact, "O operador responsável pela equipe de pagamentos é o Alan.");
  });

  test("US1: remember deve deduplicar fatos semanticamente equivalentes (> 0.92)", async () => {
    const store = new SqliteMemoryStore(":memory:");
    const fact1 = "O operador é o Alan do plantão noturno";
    const fact2 = "O operador é o Alan do plantão noturno.";

    const res1 = await store.remember("usr-1", fact1);
    assert.equal(res1.inserted, true);

    const res2 = await store.remember("usr-1", fact2);
    assert.equal(res2.inserted, false);
    assert.equal(res2.reason, "deduplicated");
    assert.ok(res2.similarity !== undefined && res2.similarity > 0.92);

    const all = store._all("usr-1");
    assert.equal(all.length, 1);
    assert.equal(all[0].fact, fact1);
  });

  test("US2: recall deve retornar top-k fatos ordenados por relevância e respeitar corte mínimo de 0.3", async () => {
    const store = new SqliteMemoryStore(":memory:");
    await store.remember("usr-1", "Eu gerencio o cluster de Kubernetes de produção.");
    await store.remember("usr-1", "Meu serviço preferido para monitoramento é o Prometheus com Grafana.");
    await store.remember("usr-1", "Eu gosto de comer pizza de calabresa no jantar.");

    // Consulta relacionada a monitoramento
    const results = await store.recall("usr-1", "Qual ferramenta de métricas o operador utiliza?", 3);

    assert.ok(results.length >= 1);
    assert.match(results[0].fact, /Prometheus/);
    assert.ok((results[0].score ?? 0) >= 0.3);

    // Consulta totalmente fora de contexto não deve trazer nada (todos < 0.3)
    const irrelevant = await store.recall("usr-1", "quantum mechanics and astrophysics", 3);
    assert.equal(irrelevant.length, 0);
  });

  test("US2: forget deve excluir a memória indicada", async () => {
    const store = new SqliteMemoryStore(":memory:");
    const res = await store.remember("usr-1", "Chave de deploy temporária: xyz-123");
    assert.equal(store._all("usr-1").length, 1);

    const removed = await store.forget("usr-1", res.memory.id);
    assert.equal(removed, true);
    assert.equal(store._all("usr-1").length, 0);

    const again = await store.forget("usr-1", res.memory.id);
    assert.equal(again, false);
  });

  test("US2: deve garantir isolamento estrito entre usuários diferentes", async () => {
    const store = new SqliteMemoryStore(":memory:");
    await store.remember("user-A", "Fato exclusivo do usuário A");
    await store.remember("user-B", "Fato exclusivo do usuário B");

    const allA = store._all("user-A");
    const allB = store._all("user-B");

    assert.equal(allA.length, 1);
    assert.equal(allA[0].fact, "Fato exclusivo do usuário A");

    assert.equal(allB.length, 1);
    assert.equal(allB[0].fact, "Fato exclusivo do usuário B");

    const recallA = await store.recall("user-A", "fato exclusivo");
    assert.equal(recallA.length, 1);
    assert.equal(recallA[0].fact, "Fato exclusivo do usuário A");
  });

  test("US4: recall deve achar fato relevante SEM NENHUMA palavra em comum", async () => {
    const store = new SqliteMemoryStore(":memory:");

    // Fato gravado
    const fatoGravado = "O operador prefere chavear tráfego para a rota de contingência em vez de reiniciar os serviços";
    await store.remember("usr-teste", fatoGravado);

    // Consulta com ZERO palavras em comum
    // Palavras do fato: o, operador, prefere, chavear, tráfego, para, a, rota, de, contingência, em, vez, reiniciar, os, serviços
    // Palavras da query: Qual, procedimento, adotar, durante, lentidão, severa
    const consultaSemPalavrasEmComum = "Qual procedimento adotar durante lentidão severa?";

    // Valida que não há interseção de palavras significativas (stop words desconsideradas ou rigorosamente nenhuma)
    const palavrasFato = new Set(fatoGravado.toLowerCase().split(/\s+/));
    const palavrasQuery = consultaSemPalavrasEmComum.toLowerCase().replace(/[?]/g, "").split(/\s+/);
    const palavrasComuns = palavrasQuery.filter((p) => palavrasFato.has(p));
    assert.deepEqual(palavrasComuns, [], "A query não deve conter nenhuma palavra presente no fato gravado");

    const resultados = await store.recall("usr-teste", consultaSemPalavrasEmComum, 3);

    assert.ok(resultados.length >= 1, "Deveria ter recuperado pelo menos um fato");
    assert.equal(resultados[0].fact, fatoGravado);
    assert.ok((resultados[0].score ?? 0) >= 0.3, "O score deve ser >= 0.3");
  });
});
