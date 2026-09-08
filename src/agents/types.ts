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

export interface ExecutionMetrics {
  llmCalls: number;
  latencyMs: number;
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
  run(input: string, options?: StrategyOptions): Promise<StrategyResult>;
}

