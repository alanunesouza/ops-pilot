export type TraceEventType =
  | "thought"
  | "action"
  | "observation"
  | "plan"
  | "critique"
  | "answer";

export interface TraceEvent {
  type: TraceEventType;
  content: string;
  tool?: string;
  args?: Record<string, unknown>;
  timestamp?: string;
}

import type { ConversationMessage } from "../store/types.js";
import type { Memory } from "../memory/types.js";

export type StrategyInput =
  | string
  | {
      message: string;
      history?: ConversationMessage[];
      memories?: Memory[];
    };

export interface ExecutionMetrics {
  llmCalls: number;
  latencyMs: number;
  historyMessages?: number;
  memoriesRecalled?: number;
}

export interface StrategyOptions {
  maxIterations?: number;
  enableReplanner?: boolean;
}

export interface StrategyResult {
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics;
}

export type ReasoningResult = StrategyResult;

export interface CritiqueResult {
  approved: boolean;
  feedback: string;
}

export interface ReflectionOptions {
  maxReflections?: number;
  model?: any;
  criticFn?: (input: string, result: StrategyResult) => Promise<CritiqueResult>;
}

export interface ReasoningStrategy {
  readonly name: string;
  run(input: StrategyInput, options?: StrategyOptions): Promise<StrategyResult>;
}

