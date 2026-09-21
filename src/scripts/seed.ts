import { SqliteOpsStore } from "../store/sqlite-ops-store.js";

export function runSeed(): void {
  console.log("==================================================");
  console.log("🌱 OpsPilot: Inicializando Seed Primário (SQLite)");
  console.log("==================================================");

  const store = new SqliteOpsStore();
  const stats = store.seed();
  const services = store.listServices();
  const firingAlerts = store.listAlerts("firing");
  const resolvedAlerts = store.listAlerts("resolved");
  const runbooks = store.listRunbooks();

  console.log(`\n📦 Serviços cadastrados (${stats.servicesCount}):`);
  for (const s of services) {
    console.log(`  - [${s.tier}] ${s.name} (${s.id}): ${s.description ?? "N/A"}`);
  }

  console.log(`\n🚨 Alertas ativos / firing (${stats.firingCount}):`);
  for (const a of firingAlerts) {
    console.log(`  - [${a.severity.toUpperCase()}] ${a.id} | ${a.service} -> ${a.title}`);
  }

  console.log(`\n✅ Alertas resolvidos / resolved (${stats.resolvedCount}):`);
  for (const a of resolvedAlerts) {
    console.log(`  - [${a.severity.toUpperCase()}] ${a.id} | ${a.service} -> ${a.title}`);
  }

  console.log(`\n📖 Runbooks operacionais cadastrados (${stats.runbooksCount}):`);
  for (const rb of runbooks) {
    console.log(`  - [${rb.service}] ${rb.title}`);
  }

  console.log("\n==================================================");
  console.log("✨ Seed executado com sucesso no SQLite!");
  console.log("==================================================");
}

runSeed();
