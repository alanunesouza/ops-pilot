import {
  ReasoningStrategy,
  StrategyOptions,
  StrategyResult,
  ReasoningResult,
  TraceEvent,
  CritiqueResult,
  ReflectionOptions,
} from "./types.js";
import { createModel } from "./model.js";
import { verdictSchema, CritiqueSchema } from "../schemas/critique.js";

export { verdictSchema, CritiqueSchema };
export type { CritiqueResult, ReflectionOptions };

export const CRITIC_PROMPT = `Você é um avaliador crítico de precisão factual para operações de infraestrutura e incidentes de TI.
Sua única responsabilidade é avaliar se a resposta proposta pelo agente é estritamente consistente, precisa e completa em relação às observações factuais extraídas durante a execução das ferramentas no trace do pedido.

Diretrizes:
1. Avalie APENAS contra as observações factuais fornecidas no trace do pedido.
2. Não invente ou presuma fatos não presentes nas observações.
3. Se a resposta for factualmente acurada, responder à pergunta e for condizente com as observações:
   - approved: true
   - feedback: uma breve justificativa da aprovação.
4. Se a resposta contiver afirmações contraditórias às observações, omitir detalhes críticos solicitados (ex.: lista de alertas, status, serviços impactados) ou inventar dados não observados:
   - approved: false
   - feedback: o que corrigir, em termos específicos e acionáveis para a próxima tentativa.`;

/**
 * Extrai e formata as observações registradas no trace.
 */
export function observationsOf(trace: TraceEvent[]): string {
  if (!Array.isArray(trace)) return "Nenhuma observação registrada.";
  const observations = trace
    .filter((event) => event.type === "observation")
    .map((event) => {
      const toolPrefix = event.tool ? `[${event.tool}] ` : "";
      return `${toolPrefix}${event.content}`;
    });

  return observations.length > 0 ? observations.join("\n") : "Nenhuma observação registrada.";
}

/**
 * Avalia criticamente a resposta gerada contra as observações do trace.
 */
export async function critique(
  input: string,
  result: ReasoningResult,
  options?: ReflectionOptions
): Promise<CritiqueResult> {
  if (options?.criticFn) {
    return options.criticFn(input, result);
  }

  const model = options?.model ?? createModel();
  const observations = observationsOf(result.trace);

  try {
    const criticModel = model.withStructuredOutput(verdictSchema);
    const verdict = await criticModel.invoke([
      ["system", CRITIC_PROMPT],
      ["user", `Pedido: ${input}\nObservações: ${observations}\nResposta: ${result.answer}`],
    ]);

    if (verdict && typeof verdict.approved === "boolean" && typeof verdict.feedback === "string") {
      return verdict;
    }
  } catch {
    // Fallback resiliente com JSON estruturado
    try {
      const fallbackPrompt = `${CRITIC_PROMPT}\nResponda estritamente em formato JSON: {"approved": boolean, "feedback": string}`;
      const rawRes = await model.invoke([
        ["system", fallbackPrompt],
        ["user", `Pedido: ${input}\nObservações: ${observations}\nResposta: ${result.answer}`],
      ]);
      const content = typeof rawRes.content === "string" ? rawRes.content : JSON.stringify(rawRes.content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return verdictSchema.parse(parsed);
      }
    } catch {
      return {
        approved: true,
        feedback: "Aprovação por tolerância a falha: falha na execução do modelo crítico.",
      };
    }
  }

  return {
    approved: true,
    feedback: "Aprovação por tolerância a falha: retorno do modelo crítico fora do formato.",
  };
}

/**
 * Função utilitária para avaliar uma resposta e observações diretamente.
 */
export async function evaluateAnswer(
  input: string,
  answer: string,
  observations: string,
  options?: ReflectionOptions
): Promise<CritiqueResult> {
  return critique(
    input,
    {
      answer,
      trace: [{ type: "observation", content: observations }],
      metrics: { llmCalls: 0, latencyMs: 0 },
    },
    options
  );
}

/**
 * Decorator que adiciona uma camada de auto-avaliação crítica e regeneração
 * reflexiva a qualquer estratégia de raciocínio.
 */
export function withReflection(
  strategy: ReasoningStrategy,
  options?: ReflectionOptions
): ReasoningStrategy {
  const maxReflections = options?.maxReflections ?? 2;

  return {
    name: `reflect:${strategy.name}`,
    async run(input: string, strategyOptions?: StrategyOptions): Promise<StrategyResult> {
      const started = Date.now();
      const consolidatedTrace: TraceEvent[] = [];
      let totalLlmCalls = 0;
      let currentInput = input;
      let lastResult: StrategyResult | undefined;
      let round = 1;

      while (round <= maxReflections) {
        try {
          const result = await strategy.run(currentInput, strategyOptions);
          lastResult = result;
          totalLlmCalls += result.metrics.llmCalls;

          // Adiciona os eventos da estratégia base ao trace consolidado
          consolidatedTrace.push(...result.trace);

          // Submete o resultado da rodada ao crítico
          const verdict = await critique(input, result, options);
          totalLlmCalls += 1;

          // Registra o evento de crítica no trace
          const critiqueStatus = verdict.approved ? "APROVADO" : "REPROVADO";
          consolidatedTrace.push({
            type: "critique",
            content: `[${critiqueStatus}] ${verdict.feedback}`,
            timestamp: new Date().toISOString(),
          });

          // Parada: aprovado ou atingiu o limite de reflexões
          if (verdict.approved || round >= maxReflections) {
            return {
              answer: result.answer,
              trace: consolidatedTrace,
              metrics: {
                llmCalls: totalLlmCalls,
                latencyMs: Date.now() - started,
              },
            };
          }

          // Se reprovado e ainda restam iterações: prepara a injeção do feedback no contexto da próxima tentativa
          const previousObservations = observationsOf(result.trace);
          currentInput = `Pedido original do operador: ${input}\n\nObservações factuais obtidas na tentativa anterior:\n${previousObservations}\n\nFeedback corretivo do crítico:\n${verdict.feedback}\n\nPor favor, execute as correções apontadas e responda ao pedido original com base nas observações factuais.`;
          round++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          consolidatedTrace.push({
            type: "critique",
            content: `Falha no ciclo de reflexão (rodada ${round}): ${errorMsg}`,
            timestamp: new Date().toISOString(),
          });

          return {
            answer: lastResult?.answer ?? `Erro na execução do ciclo de reflexão: ${errorMsg}`,
            trace: consolidatedTrace,
            metrics: {
              llmCalls: totalLlmCalls,
              latencyMs: Date.now() - started,
            },
          };
        }
      }

      return (
        lastResult ?? {
          answer: "Nenhum resultado obtido no ciclo de reflexão.",
          trace: consolidatedTrace,
          metrics: {
            llmCalls: totalLlmCalls,
            latencyMs: Date.now() - started,
          },
        }
      );
    },
  };
}
