import { parseArgs } from "node:util";
import { reactStrategy } from "./agents/react.js";
import { planAndExecuteStrategy } from "./agents/plan-and-execute.js";
import { withReflection } from "./agents/reflection.js";
import { ReasoningStrategy, StrategyResult } from "./agents/types.js";
import { formatTraceEvent, formatMetrics } from "./agents/trace.js";

const DEFAULT_PROMPT =
  "Verifique os alertas ativos no sistema com status firing. Identifique os serviços afetados e informe se há necessidade de abrir incidente.";

const reflectReactStrategy = withReflection(reactStrategy);
const reflectPlanAndExecuteStrategy = withReflection(planAndExecuteStrategy);

const availableStrategies: Record<string, ReasoningStrategy> = {
  react: reactStrategy,
  "plan-and-execute": planAndExecuteStrategy,
  "plan-execute": planAndExecuteStrategy, // alias amigável
  "reflect:react": reflectReactStrategy,
  "reflect-react": reflectReactStrategy, // alias amigável
  "reflect:plan-and-execute": reflectPlanAndExecuteStrategy,
  "reflect:plan-execute": reflectPlanAndExecuteStrategy, // alias amigável
  "reflect-plan-and-execute": reflectPlanAndExecuteStrategy, // alias amigável
};

export async function runArena() {
  const options = {
    strategies: { type: "string" as const, default: "react,plan-and-execute" },
    "max-iterations": { type: "string" as const, default: "8" },
    prompt: { type: "string" as const },
    input: { type: "string" as const },
    help: { type: "boolean" as const, default: false },
  };

  const { values, positionals } = parseArgs({
    options,
    allowPositionals: true,
    strict: false,
  });

  if (Boolean(values.help)) {
    console.log(`
OpsPilot Arena - Ambiente de Avaliação e Comparação de Raciocínio

Uso:
  npm run arena -- [prompt] [opções]

Exemplos:
  npm run arena -- "quantos alertas críticos estão disparando" --strategies react
  npm run arena -- "abra incidentes para os alertas ativos" --strategies plan-and-execute --max-iterations 6

Opções:
  --strategies <list>       Estratégias a executar separadas por vírgula (ex: react, plan-and-execute, reflect:react, reflect:plan-and-execute). Padrão: react,plan-and-execute
  --max-iterations <num>    Limite máximo de iterações por estratégia. Padrão: 8
  --prompt <texto>          Entrada ou alerta a ser analisado pelas estratégias.
  --input <texto>           Alias para --prompt.
  --help                    Exibe esta ajuda.
`);
    return;
  }

  const positionalPrompt = positionals.length > 0 ? positionals.join(" ").trim() : undefined;
  const rawInput = positionalPrompt || values.input || values.prompt || DEFAULT_PROMPT;
  const promptInput = typeof rawInput === "string" && rawInput.length > 0 ? rawInput : DEFAULT_PROMPT;

  const rawMax = values["max-iterations"] ?? "8";
  const maxIterations = parseInt(typeof rawMax === "string" ? rawMax : "8", 10);

  const rawStrategies = values.strategies ?? "react,plan-and-execute";
  const strategiesStr = typeof rawStrategies === "string" ? rawStrategies : "react,plan-and-execute";
  const strategyNames = strategiesStr
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);

  console.log("============================================================");
  console.log("🏟️  OpsPilot Reasoning Arena");
  console.log("============================================================");
  console.log(`🎯 Prompt: "${promptInput}"`);
  console.log(`⚙️  Max Iterações: ${maxIterations}`);
  console.log(`📋 Estratégias: ${strategyNames.join(", ")}`);
  console.log("============================================================\n");

  const results: Array<{
    name: string;
    result: StrategyResult;
  }> = [];

  for (const name of strategyNames) {
    const strategy = availableStrategies[name];
    if (!strategy) {
      console.error(
        `❌ Estratégia desconhecida: "${name}". Opções disponíveis: react, plan-and-execute, reflect:react, reflect:plan-and-execute`
      );
      continue;
    }

    console.log(`------------------------------------------------------------`);
    console.log(`🤖 Iniciando Execução: Estratégia [${strategy.name.toUpperCase()}]`);
    console.log(`------------------------------------------------------------`);

    const result = await strategy.run(promptInput, { maxIterations });
    results.push({ name: strategy.name, result });

    console.log(`\n📜 Trilha de Raciocínio (${result.trace.length} eventos):`);
    for (const event of result.trace) {
      console.log(`  ${formatTraceEvent(event)}`);
    }

    console.log(`\n💬 Resposta Final:`);
    console.log(`  ${result.answer}`);

    console.log(`\n${formatMetrics(result.metrics)}`);
    console.log(`------------------------------------------------------------\n`);
  }

  console.log("============================================================");
  console.log("🏁 Sumário Comparativo da Arena");
  console.log("============================================================");
  console.log("| Estratégia        | Chamadas LLM | Latência (ms) | Eventos Trace |");
  console.log("|-------------------|--------------|---------------|---------------|");

  for (const r of results) {
    const namePad = r.name.padEnd(17, " ");
    const callsPad = String(r.result.metrics.llmCalls).padStart(12, " ");
    const latencyPad = String(r.result.metrics.latencyMs).padStart(13, " ");
    const tracePad = String(r.result.trace.length).padStart(13, " ");
    console.log(`| ${namePad} | ${callsPad} | ${latencyPad} | ${tracePad} |`);
  }
  console.log("============================================================\n");
}

if (process.argv[1]?.endsWith("arena.ts") || process.argv[1]?.endsWith("arena.js")) {
  runArena().catch((err) => {
    console.error("Erro fatal na Arena:", err);
    process.exit(1);
  });
}
