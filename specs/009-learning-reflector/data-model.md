# Data Model & Contracts: Refletor de Aprendizado Contínuo (`009-learning-reflector`)

Este documento especifica os esquemas de dados, tipos TypeScript e fluxo de dados do refletor de aprendizado e da ferramenta de exclusão.

---

## 1. Esquemas Zod & Tipos

### 1.1. `LearningReflectionSchema`

```typescript
import { z } from "zod";

export const LearningReflectionSchema = z.object({
  hasLearning: z
    .boolean()
    .describe("True se a mensagem contém uma preferência durável, papel ou diretriz permanente do operador."),
  fact: z
    .string()
    .trim()
    .min(5)
    .optional()
    .describe("Fato durável formulado em terceira pessoa (ex: 'O operador prefere...')."),
});

export type LearningReflection = z.infer<typeof LearningReflectionSchema>;
```

### 1.2. `ForgetPreferenceInputSchema`

```typescript
export const ForgetPreferenceInputSchema = z.object({
  preference: z
    .string()
    .trim()
    .min(1)
    .describe("Termo ou descrição da preferência a ser esquecida."),
});

export type ForgetPreferenceInput = z.infer<typeof ForgetPreferenceInputSchema>;
```

---

## 2. Diagrama de Fluxo de Dados (Pós-Resposta)

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Cliente HTTP
    participant API as Express POST /chat
    participant RunChat as runChat Orchestrator
    participant Strategy as ReasoningStrategy (ReAct / Plan)
    participant Reflector as reflectLearning (Async Background)
    participant MemoryStore as SqliteMemoryStore

    Operador->>API: POST /chat { message, userId: "usr-1" }
    API->>RunChat: runChat(input)
    RunChat->>Strategy: run({ message, history, memories })
    Strategy-->>RunChat: ChatResponse (answer, trace, metrics)
    RunChat->>Reflector: reflectLearning("usr-1", message) [DISPARO ASSÍNCRONO]
    RunChat-->>API: 200 OK ChatResponse
    API-->>Operador: Resposta rápida sem latência adicional

    par Processamento em Background
        Reflector->>Reflector: withStructuredOutput(LearningReflectionSchema)
        alt hasLearning == true && fact válido && sem segredos
            Reflector->>MemoryStore: remember("usr-1", fact)
            MemoryStore-->>Reflector: { inserted: true/false }
        else sem aprendizado ou pedido efêmero/segredo
            Reflector->>Reflector: Ignora gravação
        end
    end
```

---

## 3. Diagrama de Exclusão de Preferência via Tool (`forget_preference`)

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Operador
    participant Agent as Agente ReAct / Plan
    participant Tool as Tool forget_preference
    participant MemoryStore as SqliteMemoryStore

    Operador->>Agent: "Esqueça que eu prefiro chaveamento de tráfego"
    Agent->>Tool: forget_preference({ preference: "chaveamento de tráfego" })
    Tool->>MemoryStore: recall(userId, "chaveamento de tráfego", 1)
    MemoryStore-->>Tool: [Memory { id: "mem-123", fact: "..." }]
    alt Memória Encontrada (score >= 0.3)
        Tool->>MemoryStore: forget(userId, "mem-123")
        MemoryStore-->>Tool: true
        Tool-->>Agent: "A preferência '...' foi removida com sucesso da sua memória."
    else Nenhuma Memória Encontrada
        Tool-->>Agent: "Nenhuma preferência correspondente foi encontrada."
    end
    Agent-->>Operador: Confirmação em linguagem natural
```
