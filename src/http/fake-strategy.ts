import {
  ReasoningStrategy,
  StrategyOptions,
  StrategyResult,
  TraceEvent,
} from "../agents/types.js";

export interface FakeStrategyOptions {
  name?: string;
  answer?: string;
  trace?: TraceEvent[];
  llmCalls?: number;
  delayMs?: number;
  shouldFail?: boolean;
  errorMessage?: string;
}

/**
 * Estratégia de teste determinística para simular a APO sem chamadas externas ou LLMs.
 */
export class FakeReasoningStrategy implements ReasoningStrategy {
  public readonly name: string;
  private answer: string;
  private trace: TraceEvent[];
  private llmCalls: number;
  private delayMs: number;
  private shouldFail: boolean;
  private errorMessage: string;

  constructor(options?: FakeStrategyOptions) {
    this.name = options?.name || "fake";
    this.answer = options?.answer || `Resposta simulada para a estratégia ${this.name}.`;
    this.trace = options?.trace || [
      {
        type: "thought",
        content: "Pensamento simulado",
        timestamp: new Date().toISOString(),
      },
      {
        type: "observation",
        content: "Observação simulada de ferramenta",
        tool: "fake_tool",
        timestamp: new Date().toISOString(),
      },
      {
        type: "answer",
        content: this.answer,
        timestamp: new Date().toISOString(),
      },
    ];
    this.llmCalls = options?.llmCalls ?? 1;
    this.delayMs = options?.delayMs ?? 0;
    this.shouldFail = options?.shouldFail ?? false;
    this.errorMessage = options?.errorMessage || "Erro simulado na estratégia fake.";
  }

  async run(input: string, _options?: StrategyOptions): Promise<StrategyResult> {
    const started = Date.now();

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }

    return {
      answer: `${this.answer} [Input: ${input}]`,
      trace: this.trace,
      metrics: {
        llmCalls: this.llmCalls,
        latencyMs: Date.now() - started,
      },
    };
  }
}
