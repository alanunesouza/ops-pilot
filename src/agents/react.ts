import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ReasoningStrategy, StrategyInput, StrategyOptions, StrategyResult } from "./types.js";
import { createModel } from "./model.js";
import { opsTools } from "./tools.js";
import { toTrace, lastText, countAiMessages } from "./trace.js";
import { composePromptWithHistory } from "../http/prompt-composer.js";

export const reactStrategy: ReasoningStrategy = {
  name: "react",
  async run(input: StrategyInput, options?: StrategyOptions): Promise<StrategyResult> {
    const started = Date.now();
    const prompt =
      typeof input === "string"
        ? input
        : composePromptWithHistory(input.message, input.history, input.memories);

    try {
      const agent = createReactAgent({
        llm: createModel(),
        tools: opsTools,
      });

      const recursionLimit = options?.maxIterations ?? 12;

      const result = await agent.invoke(
        { messages: [{ role: "user", content: prompt }] },
        { recursionLimit }
      );

      const messages = (result as { messages?: any[] }).messages ?? [];
      const answer = lastText(messages);
      const trace = toTrace(messages);
      const llmCalls = countAiMessages(messages);

      return {
        answer,
        trace,
        metrics: {
          llmCalls,
          latencyMs: Date.now() - started,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        answer: `Erro na execução da estratégia ReAct: ${msg}`,
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
