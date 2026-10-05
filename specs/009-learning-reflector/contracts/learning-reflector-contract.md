# Contract: Refletor de Aprendizado (`reflectLearning`)

Este contrato documenta a assinatura, comportamento e garantias da função de reflexão de aprendizado.

---

## Assinatura da Função

```typescript
export interface ReflectLearningOptions {
  model?: any; // BaseChatModel com suporte a withStructuredOutput
  memoryStore?: MemoryStore;
}

export async function reflectLearning(
  userId: string,
  userMessage: string,
  options?: ReflectLearningOptions
): Promise<LearningReflection>;
```

---

## Entradas

- `userId: string` — Identificador do operador (ex.: `"usr-ops-alan"`).
- `userMessage: string` — Texto literal da última mensagem enviada pelo usuário.
- `options?: ReflectLearningOptions` — Instâncias injetáveis para testes e runtime.

---

## Saída

Retorna uma `Promise<LearningReflection>`:
```typescript
interface LearningReflection {
  hasLearning: boolean;
  fact?: string;
}
```

---

## Comportamento Garantido

1. **Mensagem sem diretrizes permanentes**: Retorna `{ hasLearning: false }` e não invoca `memoryStore.remember`.
2. **Mensagem com segredos ou senhas**: Retorna `{ hasLearning: false }` e não invoca `memoryStore.remember`.
3. **Mensagem com preferência operacional durável**: Retorna `{ hasLearning: true, fact: "O operador ..." }` e invoca `memoryStore.remember(userId, fact)`.
4. **Isolamento de Falhas**: Erros de invocação de LLM ou persistência não quebram o chamador se executado com tratamento de erros.
