import { parseArgs } from "node:util";
import { store } from "./store/memory.js";
import { reactStrategy } from "./agents/react.js";
import { planAndExecuteStrategy } from "./agents/plan-and-execute.js";
import { ReasoningStrategy, StrategyResult } from "./agents/types.js";
import { formatTraceEvent } from "./agents/trace.js";

export interface ScenarioDefinition {
  id: string;
  name: string;
  type: "direto" | "estruturado" | "dinâmico";
  prompt: string;
  verifier: (result: StrategyResult) => { passed: boolean; details: string };
}

export interface BenchResult {
  scenarioId: string;
  scenarioName: string;
  strategyName: string;
  acerto: boolean;
  llmCalls: number;
  latencyMs: number;
  details: string;
  answer: string;
}

/**
 * Definição dos 3 cenários do benchmark operacional
 */
export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "C1",
    name: "C1 direto",
    type: "direto",
    prompt: "Quantos alertas críticos estão disparando?",
    verifier: (result: StrategyResult) => {
      // Estado do store: nenhum incidente deve ter sido criado indevidamente
      const incidents = store.listIncidents();
      const storeUntouched = incidents.length === 0;

      // Resposta deve identificar exatamente 1 alerta crítico disparando (alt-001 no payment-gateway)
      const text = result.answer.toLowerCase();
      const mentionsOne = /\b(1|um|apenas um|somente um)\b/i.test(text);
      const doesNotSayZeroOrMore = !/\b(0|zero|2|dois|3|três|nenhum)\b.*crítico/i.test(text);
      const passed = storeUntouched && mentionsOne && doesNotSayZeroOrMore;

      const details = passed
        ? "Identificou corretamente 1 alerta crítico ativo sem alterar incidentes no store."
        : `Falhou na verificação: storeUntouched=${storeUntouched}, mentionsOne=${mentionsOne}.`;

      return { passed, details };
    },
  },
  {
    id: "C2",
    name: "C2 estruturado",
    type: "estruturado",
    prompt:
      "Abra três incidentes de sev2 para checkout, payment e catalog nessa mesma ordem, e resolva o primeiro.",
    verifier: () => {
      const incidents = store.listIncidents();

      // 1. Deve ter criado exatamente 3 incidentes
      if (incidents.length < 3) {
        return {
          passed: false,
          details: `Foram criados apenas ${incidents.length} incidentes (esperado: 3).`,
        };
      }

      // 2. Ordem estrita dos serviços: checkout, payment, catalog
      const firstServiceMatches =
        /checkout/i.test(incidents[0]?.service) || /checkout/i.test(incidents[0]?.title);
      const secondServiceMatches =
        /payment/i.test(incidents[1]?.service) || /payment/i.test(incidents[1]?.title);
      const thirdServiceMatches =
        /catalog/i.test(incidents[2]?.service) ||
        /catalog/i.test(incidents[2]?.title) ||
        /inventory/i.test(incidents[2]?.service);

      // 3. Primeiro resolvido, segundo e terceiro abertos
      const firstResolved = incidents[0]?.status === "resolved";
      const secondOpen = incidents[1]?.status === "open";
      const thirdOpen = incidents[2]?.status === "open";

      const orderMatches = firstServiceMatches && secondServiceMatches && thirdServiceMatches;
      const statusMatches = firstResolved && secondOpen && thirdOpen;

      const passed = orderMatches && statusMatches;
      const details = passed
        ? "3 incidentes criados na ordem correta (checkout, payment, catalog) e o primeiro foi resolvido com sucesso."
        : `Inconsistência no store: ordem=${orderMatches} (s1=${incidents[0]?.service}, s2=${incidents[1]?.service}, s3=${incidents[2]?.service}), status=${statusMatches} (st1=${incidents[0]?.status}, st2=${incidents[1]?.status}, st3=${incidents[2]?.status}).`;

      return { passed, details };
    },
  },
  {
    id: "C3",
    name: "C3 dinâmico",
    type: "dinâmico",
    prompt: "Dos alertas disparando, abra um incidente para o mais antigo e diga quantos sobraram",
    verifier: (result: StrategyResult) => {
      const incidents = store.listIncidents();

      // O alerta firing mais antigo no seed é alt-001 (14:30:00 - payment-gateway)
      const oneIncidentCreated = incidents.length === 1;
      const targetOldest =
        /payment/i.test(incidents[0]?.service || "") ||
        /alt-001/i.test(incidents[0]?.title || "") ||
        /checkout/i.test(incidents[0]?.title || "");

      // Resposta deve mencionar que restaram 2 alertas disparando
      const answerMentionsTwoRemaining = /\b(2|dois)\b/i.test(result.answer);

      const passed = oneIncidentCreated && targetOldest && answerMentionsTwoRemaining;
      const details = passed
        ? "Incidente aberto para o alerta firing mais antigo (payment-gateway/alt-001) e reportou 2 alertas restantes."
        : `Falhou na verificação: incidentesCriados=${incidents.length}, alvoMaisAntigo=${targetOldest}, respostaMencionouDois=${answerMentionsTwoRemaining}.`;

      return { passed, details };
    },
  },
];

/**
 * Executa um cenário com uma dada estratégia garantindo isolamento total do store
 */
export async function executeBenchmarkItem(
  scenario: ScenarioDefinition,
  strategy: ReasoningStrategy,
  options?: { noReplanner?: boolean }
): Promise<BenchResult> {
  // Reset obrigatório do estado do store antes de cada execução
  store.resetStore();

  const enableReplanner = !options?.noReplanner;
  const result = await strategy.run(scenario.prompt, {
    maxIterations: 8,
    enableReplanner,
  });

  const verification = scenario.verifier(result);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    strategyName: strategy.name,
    acerto: verification.passed,
    llmCalls: result.metrics.llmCalls,
    latencyMs: result.metrics.latencyMs,
    details: verification.details,
    answer: result.answer,
  };
}

/**
 * Formata e exibe a tabela consolidada de benchmark
 */
export function printConsolidatedTable(results: BenchResult[]) {
  console.log("\n=========================================================================================");
  console.log("📊 TABELA CONSOLIDADA DO BENCHMARK");
  console.log("=========================================================================================");
  console.log("| cenário       | estratégia       | acerto | llCalls | latencyMs |");
  console.log("|---------------|------------------|--------|---------|-----------|");

  for (const r of results) {
    const scenPad = r.scenarioName.padEnd(13, " ");
    const stratPad = r.strategyName.padEnd(16, " ");
    const acertoPad = (r.acerto ? "✅ SIM" : "❌ NÃO").padEnd(6, " ");
    const callsPad = String(r.llmCalls).padStart(7, " ");
    const latencyPad = `${r.latencyMs}ms`.padStart(9, " ");

    console.log(`| ${scenPad} | ${stratPad} | ${acertoPad} | ${callsPad} | ${latencyPad} |`);
  }
  console.log("=========================================================================================\n");
}

/**
 * CLI Principal do Benchmark
 */
export async function runBenchmark() {
  const options = {
    scenario: { type: "string" as const },
    "no-replanner": { type: "boolean" as const, default: false },
    help: { type: "boolean" as const, default: false },
  };

  const { values } = parseArgs({
    options,
    allowPositionals: true,
    strict: false,
  });

  if (Boolean(values.help)) {
    console.log(`
OpsPilot Benchmark - Avaliação Comparativa de Estratégias

Uso:
  npm run bench -- [opções]

Opções:
  --scenario <id>     Filtra execução por cenário específico (ex: C1, C2, C3). Padrão: todos (C1, C2, C3)
  --no-replanner      Desativa a etapa de replanejador dinâmico na estratégia plan-and-execute
  --help              Exibe esta ajuda.

Cenários:
  - C1 direto:       "Quantos alertas críticos estão disparando?"
  - C2 estruturado:  "Abra três incidentes de sev2 para checkout, payment e catalog nessa mesma ordem, e resolva o primeiro."
  - C3 dinâmico:     "Dos alertas disparando, abra um incidente para o mais antigo e diga quantos sobraram"
`);
    return;
  }

  const noReplanner = Boolean(values["no-replanner"]);
  const scenarioFilter = values.scenario ? String(values.scenario).trim().toUpperCase() : undefined;

  let selectedScenarios = SCENARIOS;
  if (scenarioFilter && scenarioFilter !== "ALL") {
    selectedScenarios = SCENARIOS.filter(
      (s) =>
        s.id.toUpperCase() === scenarioFilter ||
        s.id.toUpperCase() === `C${scenarioFilter}` ||
        s.name.toUpperCase().includes(scenarioFilter)
    );
    if (selectedScenarios.length === 0) {
      console.error(
        `❌ Cenário inválido: "${values.scenario}". Opções válidas: C1, C2, C3 ou all.`
      );
      process.exit(1);
    }
  }

  const strategies: ReasoningStrategy[] = [reactStrategy, planAndExecuteStrategy];

  console.log("=========================================================================================");
  console.log("🚀 OpsPilot Benchmark de Raciocínio (3 Cenários x 2 Estratégias)");
  console.log("=========================================================================================");
  console.log(`📋 Cenários: ${selectedScenarios.map((s) => s.id).join(", ")}`);
  console.log(`🤖 Estratégias: ${strategies.map((s) => s.name).join(", ")}`);
  console.log(`⚡ Replanner: ${noReplanner ? "DESATIVADO (--no-replanner)" : "ATIVADO"}`);
  console.log("=========================================================================================\n");

  const results: BenchResult[] = [];

  for (const scenario of selectedScenarios) {
    console.log(`\n-----------------------------------------------------------------------------------------`);
    console.log(`🎯 Cenário [${scenario.id}]: ${scenario.name}`);
    console.log(`💬 Prompt: "${scenario.prompt}"`);
    console.log(`-----------------------------------------------------------------------------------------`);

    for (const strategy of strategies) {
      console.log(`\n⏳ Executando [${strategy.name}] no cenário [${scenario.id}]...`);

      const benchItem = await executeBenchmarkItem(scenario, strategy, { noReplanner });
      results.push(benchItem);

      const statusBadge = benchItem.acerto ? "✅ ACERTO" : "❌ ERRO";
      console.log(`Resultado: ${statusBadge} | ${benchItem.llmCalls} chamadas | ${benchItem.latencyMs}ms`);
      console.log(`Detalhes da Verificação: ${benchItem.details}`);
      console.log(`Resposta da IA: ${benchItem.answer.trim().substring(0, 150)}...`);
    }
  }

  printConsolidatedTable(results);
}

if (process.argv[1]?.endsWith("bench.ts") || process.argv[1]?.endsWith("bench.js")) {
  runBenchmark().catch((err) => {
    console.error("Erro fatal no Benchmark:", err);
    process.exit(1);
  });
}
