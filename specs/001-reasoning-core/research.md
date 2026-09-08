# Research: Núcleo de Raciocínio do OpsPilot

**Feature**: Núcleo de Raciocínio (ReAct, Plan-and-Execute, Tools, Store, Arena)  
**Spec**: [spec.md](./spec.md)  
**Date**: 2026-09-06

---

## 1. Fábrica de Modelos de Linguagem (OpenRouter Integration)

### Contexto
O OpsPilot precisa de uma fonte única e previsível de clientes de modelo de linguagem que aponte para o OpenRouter via `@langchain/openai`, garantindo que todas as estratégias (ReAct e Plan-and-Execute) compartilhem a mesma parametrização de temperatura (`0`) e configuração de credenciais.

### Decisão
Criar `src/agents/model.ts` que exporta a função `getLanguageModel(options?: { modelName?: string; temperature?: number })`.  
- Utiliza a classe `ChatOpenAI` de `@langchain/openai`.
- Configura `configuration.baseURL = "https://openrouter.ai/api/v1"`.
- Lê `apiKey: process.env.OPENROUTER_API_KEY` e modelo padrão de `process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet"`.
- Define `temperature: 0` por padrão para garantir reprodutibilidade operacional.
- Valida na inicialização as variáveis com schema Zod (`EnvSchema`), lançando erro descritivo de domínio caso ausentes em tempo de execução real.

### Alternativas Consideradas
- **Instanciação direta em cada estratégia**: Rejeitada por violar o princípio DRY e dificultar a troca unificada de modelos ou medição global de custos/tokens.
- **Uso do SDK nativo da OpenAI sem LangChain**: Rejeitado pois o LangGraph se integra nativamente com `BaseChatModel` da LangChain para bind de tools e chamadas estruturadas.

---

## 2. Contrato da Interface `ReasoningStrategy` e Formatação de Traces

### Contexto
O sistema precisa de uma abstração polimórfica para que o núcleo operacional ou a CLI da Arena execute qualquer estratégia sem acoplamento a grafos específicos. Além disso, cada evento intermediário do agente (`thought`, `action`, `observation`, `plan`, `critique`, `answer`) precisa ser registrado estruturadamente.

### Decisão
- Definir o tipo em `src/agents/types.ts`:
  ```typescript
  export type TraceEventType = "thought" | "action" | "observation" | "plan" | "critique" | "answer";

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

  export interface StrategyResult {
    answer: string;
    trace: TraceEvent[];
    metrics: ExecutionMetrics;
  }

  export interface StrategyOptions {
    maxIterations?: number;
  }

  export interface ReasoningStrategy {
    name: string;
    run(input: string, options?: StrategyOptions): Promise<StrategyResult>;
  }
  ```
- **Contador de chamadas e latência**: Um callback handler (`BaseCallbackHandler`) do LangChain é injetado durante a execução de cada estratégia para interceptar `handleLLMStart` e incrementar deterministicamente `llmCalls`, medindo o delta de tempo com `performance.now()` para calcular `latencyMs`.

### Alternativas Consideradas
- **Logs soltos em console**: Rejeitado por impossibilitar auditoria estruturada, testes automatizados e comparação na Arena.
- **Traces sem tipagem estrita de action/observation**: Rejeitado pois a spec exige que ações tragam explicitamente o nome da tool e os argumentos validados.

---

## 3. Implementação da Estratégia ReAct

### Contexto
A estratégia ReAct deve resolver incidentes operacionais de forma autônoma alternando entre raciocínio e ação, utilizando o agente pré-construído do LangGraph (`createReactAgent` de `@langchain/langgraph/prebuilt`).

### Decisão
- Criar `src/agents/react.ts` exportando `ReActStrategy implements ReasoningStrategy`.
- Utilizar `createReactAgent({ llm: model, tools: agentTools })`.
- Utilizar um coletor customizado que converte as mensagens intermediárias do LangGraph (`AIMessage` com `tool_calls` -> `action`, `ToolMessage` -> `observation`, raciocínio textual -> `thought`, mensagem final sem tool calls -> `answer`) no array padronizado de `TraceEvent`.
- Suportar limite de recursão/iterações via parâmetro `recursionLimit` do LangGraph configurável por `options.maxIterations`.

### Alternativas Consideradas
- **ReAct manual via strings e regex**: Rejeitado por ser frágil e não aproveitar os mecanismos nativos de function calling das LLMs modernas.
- **LangChain Legacy ReAct Agent**: Rejeitado pois o LangGraph é o padrão moderno adotado pelo projeto.

---

## 4. Implementação da Estratégia Plan-and-Execute

### Contexto
Para problemas operacionais de mitigação que exigem visão estruturada, o modelo precisa decompor a meta em uma lista de passos, executar um passo de cada vez com ferramentas e acionar um replanejador após cada observação para atualizar ou encerrar a lista, com teto fixo de no máximo 8 passos.

### Decisão
- Implementar em `src/agents/plan-and-execute.ts` um `StateGraph` do `@langchain/langgraph` com o seguinte estado:
  ```typescript
  interface PlanExecuteState {
    input: string;
    plan: string[];
    pastSteps: [string, string][]; // [passo, resultado]
    currentStepIndex: number;
    response?: string;
    iterations: number;
    trace: TraceEvent[];
  }
  ```
- **Nó 1: Planner**: Gera com structured output (`zodSchema`) a lista inicial de etapas (`{ steps: string[] }`). Emite evento `plan`.
- **Nó 2: Executor**: Executa o passo atual utilizando o agente executor com as tools, sintetiza a observação e anexa aos `pastSteps`. Emite eventos `action` e `observation`.
- **Nó 3: Replanner**: Recebe o input original, o plano, os passos executados e o resultado do último passo. Utiliza structured output para decidir entre:
  1. Concluir: `{ action: "finish", response: string }`
  2. Continuar: `{ action: "continue", remainingSteps: string[] }`
- **Condição de Parada (Router)**:
  - Se `action === "finish"` ou se não houver mais passos pendentes -> encerra e formata `answer`.
  - Se `iterations >= maxIterations` ou `iterations >= 8` (teto estrito da spec) -> encerra forçadamente emitindo crítica e resposta consolidada.
  - Caso contrário -> retorna ao `executor`.

### Alternativas Consideradas
- **Plano estático sem replanner**: Rejeitado pois operações em produção frequentemente encontram estados inesperados que invalidam passos subsequentes.
- **Passos ilimitados**: Rejeitado expressamente pela spec (limite máximo de 8 passos para mitigar custos e loops).

---

## 5. Ferramentas Operacionais e Store In-Memory

### Contexto
As ferramentas precisam inspecionar alertas, abrir incidentes e resolvê-los de forma segura e determinística.

### Decisão
- Em `src/agents/tools.ts`, criar ferramentas LangChain utilizando a função `tool` de `@langchain/core/tools` combinada com schemas `zod`:
  - `list_alerts`: schema `{ status?: z.enum(["firing", "resolved"]) }`.
  - `open_incident`: schema `{ title: z.string(), service: z.string(), severity: z.enum(["low", "medium", "high", "critical"]) }`.
  - `resolve_incident`: schema `{ id: z.string() }`.
- Todas operam sobre a instância `memoryStore` de `src/store/memory.ts`.
- Validações garantem que erros de schema ou IDs inexistentes retornem mensagens textuais claras ao invés de quebrar o processo do agente.

### Alternativas Consideradas
- **Chamadas diretas a banco SQL externo durante os testes**: Rejeitado por violar a determinação de testes offline rápidos e determinísticos. O store in-memory atua como camada de persistência mock compatível com o domínio.

---

## 6. Arena CLI (`src/arena.ts`)

### Contexto
Permitir a avaliação comparativa de estratégias através de linha de comando com controle de iterações e exibição visual dos traces e métricas.

### Decisão
- Criar `src/arena.ts` executável com suporte a argumentos CLI via `node:util.parseArgs`:
  - `--strategies`: lista separada por vírgula (ex.: `react,plan-and-execute`). Padrão: ambas.
  - `--max-iterations`: número máximo de iterações (default: `8`).
  - `--prompt` / `--input`: texto de entrada para as estratégias. Padrão: cenário representativo de incidente on-call.
- Exibir cada estratégia com:
  1. Cabeçalho identificando a estratégia
  2. Trilha cronológica de eventos com formatação visual
  3. Resposta final obtida
  4. Tabela consolidada de métricas: latência (ms) e chamadas de LLM

---

## 7. Estratégia de Testes Automatizados

### Contexto
O projeto exige testes em `node:test` + `tsx` sem chamadas externas de rede e 100% determinísticos.

### Decisão
- Criar `src/store/memory.test.ts`:
  - Valida o seed inicial (5 serviços, 6 alertas: 3 firing, 3 resolved).
  - Valida filtro de alertas por status `firing` e `resolved`.
  - Valida criação de incidente e resolução por ID.
  - Valida validação estrita com Zod (rejeição de payloads malformados).
- Criar `src/agents/trace.test.ts`:
  - Valida a serialização e formatação de cada tipo de `TraceEvent`.
  - Valida cálculo e totalização das `ExecutionMetrics`.
- Criar `src/agents/tools.test.ts`:
  - Valida invocação direta das tools `list_alerts`, `open_incident` e `resolve_incident` sobre o store sem requisições HTTP.
