import { memoryStore } from "../store/memory.js";

export function runSeed(): void {
  console.log("==================================================");
  console.log("🌱 OpsPilot: Inicializando Seed Primário");
  console.log("==================================================");

  const stats = memoryStore.seed();
  const services = memoryStore.listServices();
  const firingAlerts = memoryStore.listAlerts("firing");
  const resolvedAlerts = memoryStore.listAlerts("resolved");

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

  console.log("\n==================================================");
  console.log("✨ Seed executado com sucesso e validado via Zod!");
  console.log("==================================================");
}

runSeed();
