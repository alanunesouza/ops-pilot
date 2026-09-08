# Contract: Reflection Layer Interface

Este contrato define a interface pública exposta pelo módulo de reflexão em `src/agents/reflection.ts`.

---

## 1. Assinatura da Função Decorator

```typescript
import { ReasoningStrategy, StrategyOptions, StrategyResult } from "./types.js";

export interface ReflectionOptions {
  maxReflections?: number;
}

export function withReflection(
  strategy: ReasoningStrategy,
  options?: ReflectionOptions
): ReasoningStrategy;
```

---

## 2. Invariantes de Comportamento

1. **Transparência de Interface**: O objeto retornado por `withReflection` implementa estritamente `ReasoningStrategy`, podendo ser consumido indistintamente pela Arena CLI, por controllers HTTP ou por outras estratégias compostas.
2. **Nome Canônico**: O nome da estratégia decorada segue o padrão `reflect:${strategy.name}`.
3. **Presença Obrigatória do Evento `critique`**: O array `trace` resultante contém pelo menos um evento com `type: "critique"` atestando a avaliação do crítico.
4. **Respeito ao Teto `maxReflections`**: O número de avaliações do crítico nunca excede o valor configurado em `options.maxReflections` (default: 2).
5. **Agregação de Métricas**:
   - `result.metrics.llmCalls = sum(baseStrategy.llmCalls) + criticCalls`
   - `result.metrics.latencyMs = totalWallClockTime`
6. **Robustez a Falhas**: Se a estratégia base ou o crítico emitir erro de rede ou parsing, a camada de reflexão trata graciosamente retornando a melhor resposta possível com evento de crítica explicativo sem derrubar a aplicação.
