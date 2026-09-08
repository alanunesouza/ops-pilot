# Contract: Reasoning Strategy Interface

Este contrato define a interface pública exposta pelo módulo de agentes para qualquer estratégia de raciocínio da APO.

## Interface TypeScript

```typescript
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
  timestamp: string;
}

export interface ExecutionMetrics {
  llmCalls: number;
  latencyMs: number;
}

export interface StrategyOptions {
  maxIterations?: number;
}

export interface StrategyResult {
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics;
}

export interface ReasoningStrategy {
  readonly name: string;
  run(input: string, options?: StrategyOptions): Promise<StrategyResult>;
}
```

## Garantias e Invariantes

1. **Determinismo de Resposta**: Toda chamada ao método `run()` retorna um objeto `StrategyResult` completo. Não retorna `null` ou `undefined`.
2. **Auditoria de Eventos**: O array `trace` contém todos os eventos gerados em ordem cronológica de ocorrência.
3. **Eventos do tipo `action`**: Obrigatoriamente especificam a propriedade `tool` contendo o nome exato da ferramenta chamada e `args` com os parâmetros validados.
4. **Respeito a Limites**: Quando `options.maxIterations` for atingido, a execução encerra graciosamente gerando evento de encerramento sem lançar exceção não tratada.
5. **Métricas**: `metrics.llmCalls` reflete a quantidade real de invocações à LLM; `metrics.latencyMs` reflete o tempo de relógio decorrido (`performance.now()`).
