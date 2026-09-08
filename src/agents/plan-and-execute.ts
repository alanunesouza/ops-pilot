import { z } from "zod";
import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ReasoningStrategy, StrategyOptions, StrategyResult, TraceEvent } from "./types.js";
import { createModel } from "./model.js";
import { opsTools } from "./tools.js";
import { toTrace, lastText, countAiMessages } from "./trace.js";

export const PlanSchema = z.object({
  steps: z
    .array(z.string())
    .min(1)
    .describe("Lista de passos em ordem de execução para resolver o incidente"),
});

export const ActSchema = z.object({
  action: z
    .enum(["continue", "finish"])
    .describe("Defina 'finish' se o problema foi resolvido ou 'continue' se passos adicionais forem necessários"),
  response: z
    .string()
    .optional()
    .describe("Se action for 'finish', forneça a resposta final para o operador"),
  remainingSteps: z
    .array(z.string())
    .optional()
    .describe("Se action for 'continue', forneça os passos atualizados que ainda faltam executar"),
});

export const PlanExecuteAnnotation = Annotation.Root({
  input: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  plan: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  pastSteps: Annotation<Array<{ step: string; result: string }>>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  response: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  iterations: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  trace: Annotation<TraceEvent[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  maxIterations: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 8,
  }),
  totalLlmCalls: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
});

export type PlanExecuteState = typeof PlanExecuteAnnotation.State;

const MAX_STEPS_LIMIT = 8;

export function parseStepsFallback(text: string): string[] {
  if (!text || text.trim() === "") return [];

  // Tenta extrair JSON de markdown block ou direto
  try {
    const jsonMatch = text.match(/\{[\s\S]*"steps"[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      if (Array.isArray(parsed.steps)) return parsed.steps.map(String).filter(Boolean);
    }
  } catch {
    // continua para fallback baseado em linhas
  }

  // Tenta extrair linhas numeradas (1. Passo, 2. Passo) ou marcadores (- , * )
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[\s*\-•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 5 && !l.startsWith("{") && !l.startsWith("}"));

  if (lines.length > 0) {
    return lines;
  }

  return [text.trim()];
}

export function createPlanAndExecuteGraph(enableReplanner: boolean = true) {
  const model = createModel();

  const planner = async (state: PlanExecuteState) => {
    state.totalLlmCalls += 1;
    let initialPlan: string[] = [];

    const systemPrompt =
      "Você é o planejador da APO (OpsPilot). Decomponha o problema do operador em passos simples e sequenciais para resolução via ferramentas de monitoramento e incidentes (máximo 8 passos). Responda estritamente em formato JSON: {\"steps\": [\"passo 1\", \"passo 2\"]}";

    try {
      const plannerLlm = model.withStructuredOutput(PlanSchema);
      const res = await plannerLlm.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: state.input },
      ]);
      if (res?.steps && res.steps.length > 0) {
        initialPlan = res.steps;
      }
    } catch {
      // Fallback robusto se o structured output do modelo falhar ou retornar vazio
      try {
        const rawRes = await model.invoke([
          { role: "system", content: systemPrompt },
          { role: "user", content: state.input },
        ]);
        const content = typeof rawRes.content === "string" ? rawRes.content : JSON.stringify(rawRes.content);
        initialPlan = parseStepsFallback(content);
      } catch {
        initialPlan = [state.input];
      }
    }

    if (initialPlan.length === 0) {
      initialPlan = [state.input];
    }

    initialPlan = initialPlan.slice(0, MAX_STEPS_LIMIT);

    const traceEvent: TraceEvent = {
      type: "plan",
      content: `Plano inicial gerado com ${initialPlan.length} passos: ${initialPlan.join(" -> ")}`,
      timestamp: new Date().toISOString(),
    };

    return {
      plan: initialPlan,
      trace: [...state.trace, traceEvent],
    };
  };

  const executor = async (state: PlanExecuteState) => {
    const currentStep = state.plan[0];
    if (!currentStep) return {};

    const executorAgent = createReactAgent({
      llm: model,
      tools: opsTools,
    });

    const execPrompt = `Execute o seguinte passo do plano operacional usando as ferramentas necessárias:\nPasso: ${currentStep}\nContexto Original: ${state.input}`;
    const result = await executorAgent.invoke({
      messages: [{ role: "user", content: execPrompt }],
    });

    const messages = (result as { messages?: any[] }).messages ?? [];
    const stepOutput = lastText(messages) || "Passo executado.";
    const stepTrace = toTrace(messages);
    const stepLlmCalls = countAiMessages(messages);

    const pastSteps = [...state.pastSteps, { step: currentStep, result: stepOutput }];
    const remainingPlan = state.plan.slice(1);
    const iterations = state.iterations + 1;

    return {
      pastSteps,
      plan: remainingPlan,
      iterations,
      totalLlmCalls: state.totalLlmCalls + stepLlmCalls,
      trace: [...state.trace, ...stepTrace],
    };
  };

  const replanner = async (state: PlanExecuteState) => {
    const limit = Math.min(state.maxIterations || MAX_STEPS_LIMIT, MAX_STEPS_LIMIT);

    if (state.iterations >= limit) {
      const summaryText = state.pastSteps
        .map((p, idx) => `${idx + 1}. ${p.step} => ${p.result}`)
        .join("\n");

      const finalResponse = `A execução foi encerrada ao atingir o limite de ${limit} passos. Resumo das ações realizadas:\n${summaryText}`;
      const critiqueEvent: TraceEvent = {
        type: "critique",
        content: `Teto de ${limit} passos atingido. Finalizando execução adaptativa.`,
        timestamp: new Date().toISOString(),
      };
      const answerEvent: TraceEvent = {
        type: "answer",
        content: finalResponse,
        timestamp: new Date().toISOString(),
      };

      return {
        response: finalResponse,
        trace: [...state.trace, critiqueEvent, answerEvent],
      };
    }

    if (state.plan.length === 0) {
      const summaryText = state.pastSteps
        .map((p, idx) => `${idx + 1}. ${p.step} => ${p.result}`)
        .join("\n");

      const finalResponse = `Todas as etapas planejadas foram concluídas com sucesso:\n${summaryText}`;
      const answerEvent: TraceEvent = {
        type: "answer",
        content: finalResponse,
        timestamp: new Date().toISOString(),
      };

      return {
        response: finalResponse,
        trace: [...state.trace, answerEvent],
      };
    }

    if (!enableReplanner) {
      // Sem replanner: segue os passos restantes do plano original sem chamar o LLM para replanejar
      return {
        plan: state.plan,
      };
    }

    state.totalLlmCalls += 1;
    const pastStepsText = state.pastSteps
      .map((p) => `- Passo: ${p.step}\n  Resultado: ${p.result}`)
      .join("\n");

    const replannerPrompt = `Objetivo Original: ${state.input}
Passos já executados:
${pastStepsText}

Passos restantes planejados:
${state.plan.join("\n")}

Com base no progresso atual, decida se o objetivo foi concluído ('finish') fornecendo uma resposta conclusiva ou se ainda há passos a executar ('continue'). Responda estritamente em JSON: {"action": "continue"|"finish", "response": "texto se finish", "remainingSteps": ["passos restantes se continue"]}`;

    let decision: z.infer<typeof ActSchema> = { action: "continue", remainingSteps: state.plan };

    try {
      const replannerLlm = model.withStructuredOutput(ActSchema);
      const res = await replannerLlm.invoke([
        { role: "system", content: "Você é o replanejador operacional do OpsPilot." },
        { role: "user", content: replannerPrompt },
      ]);
      if (res?.action) {
        decision = res;
      }
    } catch {
      // Se structured output falhar, verifica se restam passos
      if (state.plan.length === 0) {
        decision = { action: "finish", response: "Objetivo operacional concluído." };
      } else {
        decision = { action: "continue", remainingSteps: state.plan };
      }
    }

    if (decision.action === "finish") {
      const answer = decision.response || "Incidente tratado com sucesso.";
      const answerEvent: TraceEvent = {
        type: "answer",
        content: answer,
        timestamp: new Date().toISOString(),
      };
      return {
        response: answer,
        trace: [...state.trace, answerEvent],
      };
    }

    const updatedPlan =
      decision.remainingSteps && decision.remainingSteps.length > 0
        ? decision.remainingSteps.slice(0, MAX_STEPS_LIMIT - state.iterations)
        : state.plan;

    const planUpdateEvent: TraceEvent = {
      type: "plan",
      content: `Plano revisado pelo replanner (${updatedPlan.length} passos restantes): ${updatedPlan.join(" -> ")}`,
      timestamp: new Date().toISOString(),
    };

    return {
      plan: updatedPlan,
      trace: [...state.trace, planUpdateEvent],
    };
  };

  const shouldContinue = (state: PlanExecuteState): "executor" | typeof END => {
    if (state.response) return END;
    if (state.iterations >= Math.min(state.maxIterations || MAX_STEPS_LIMIT, MAX_STEPS_LIMIT)) return END;
    if (state.plan.length === 0) return END;
    return "executor";
  };

  const workflow = new StateGraph(PlanExecuteAnnotation)
    .addNode("planner", planner)
    .addNode("executor", executor)
    .addNode("replanner", replanner)
    .addEdge(START, "planner")
    .addEdge("planner", "executor")
    .addEdge("executor", "replanner")
    .addConditionalEdges("replanner", shouldContinue, ["executor", END]);

  return workflow.compile();
}

export const planAndExecuteStrategy: ReasoningStrategy = {
  name: "plan-and-execute",
  async run(input: string, options?: StrategyOptions): Promise<StrategyResult> {
    const started = Date.now();
    const maxIterations = Math.min(options?.maxIterations ?? MAX_STEPS_LIMIT, MAX_STEPS_LIMIT);
    const enableReplanner = options?.enableReplanner !== false;

    try {
      const app = createPlanAndExecuteGraph(enableReplanner);
      const finalState = await app.invoke({
        input,
        plan: [],
        pastSteps: [],
        iterations: 0,
        trace: [],
        maxIterations,
        totalLlmCalls: 0,
      });

      return {
        answer: finalState.response || "Execução concluída.",
        trace: finalState.trace || [],
        metrics: {
          llmCalls: finalState.totalLlmCalls || 1,
          latencyMs: Date.now() - started,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        answer: `Erro na estratégia Plan-and-Execute: ${msg}`,
        trace: [
          {
            type: "critique",
            content: `Falha de execução: ${msg}`,
            timestamp: new Date().toISOString(),
          },
        ],
        metrics: {
          llmCalls: 0,
          latencyMs: Date.now() - started,
        },
      };
    }
  },
};
