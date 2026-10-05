# Research: Conversa Persistente (`007-persistent-conversation`)

**Feature Branch**: `007-persistent-conversation`  
**Date**: 2026-10-04  
**Spec**: [spec.md](./spec.md)

---

## 1. Contexto e Objetivos

A funcionalidade introduz o gerenciamento transacional e durável de histórico de diálogo para o OpsPilot, permitindo que a interação entre operadores e agentes via `POST /chat` mantenha contexto entre requisições sem depender de estado volátil em memória.

Os componentes centrais a serem pesquisados e projetados são:
1. Modelagem relacional e DDL da tabela `messages` usando `node:sqlite` (`DatabaseSync`).
2. Contrato e implementação do `ConversationStore` (`create`, `append`, `lastMessages`).
3. Composição das 12 mensagens mais recentes no prompt do modelo e métrica `historyMessages`.
4. Extensão retrocompatível dos schemas de entrada e saída do endpoint `POST /chat`.
5. Isolamento determinístico em testes utilizando `:memory:` e `FakeReasoningStrategy`.

---

## 2. Decisões Arquiteturais e Pesquisas Técnicas

### 2.1. Modelagem Relacional e Armazenamento SQLite (`messages`)

- **Decisão**: Criar a tabela `messages` no mesmo banco de dados SQLite utilizado pelo `SqliteOpsStore` (configurado via `OPSPILOT_DB`, padrão `./data/opspilot.db`), gerenciada pela classe `SqliteConversationStore` (ou como parte integrada do store).
- **Esquema Relacional**:
  ```sql
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON messages (conversation_id, created_at ASC);
  ```
- **Rationale**:
  - `DatabaseSync` do Node.js 22 LTS é síncrono e já está padronizado no projeto pela Constituição (Princípio da Stack Obrigatória).
  - O índice composto `(conversation_id, created_at)` garante que a ordenação e paginação das últimas $N$ mensagens seja resolvida em tempo $O(\log M + K)$ sem varredura completa da tabela.
  - A restrição `CHECK (role IN ('user', 'assistant', 'system'))` garante integridade estrita no nível relacional.
- **Alternativas consideradas**:
  - *Tabela separada `conversations`*: Avaliada para armazenar metadados de sessão (ex.: título, operador). Rejeitada no momento por YAGNI, pois `conversation_id` em `messages` atende plenamente ao MVP e aos requisitos estipulados.
  - *Arquivo JSON por conversa*: Rejeitada por violar o princípio de persistência relacional do projeto e dificultar atomicidade e concorrência.

---

### 2.2. Interface e Métodos do `ConversationStore`

- **Decisão**: Definir a interface `ConversationStore` com três métodos fundamentais:
  ```typescript
  export interface ConversationMessage {
    id: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
  }

  export interface ConversationStore {
    create(): string;
    append(conversationId: string, role: "user" | "assistant" | "system", content: string): ConversationMessage;
    lastMessages(conversationId: string, limit?: number): ConversationMessage[];
  }
  ```
- **Rationale**:
  - `create()`: Gera um identificador único seguro (UUID v4 via `crypto.randomUUID()`).
  - `append()`: Persiste a mensagem via *prepared statement* parametrizado (`INSERT INTO messages ...`) e retorna a entidade tipada.
  - `lastMessages()`: Executa uma query otimizada recuperando as mensagens mais recentes (padrão 12) e ordenando em ordem cronológica crescente para consumo direto pelo prompt:
    ```sql
    SELECT id, conversation_id AS conversationId, role, content, created_at AS createdAt
    FROM (
      SELECT id, conversation_id, role, content, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    )
    ORDER BY created_at ASC, id ASC;
    ```
- **Alternativas consideradas**:
  - *Retornar em ordem decrescente*: Rejeitada porque o modelo de linguagem precisa ler os turnos de diálogo na sequência cronológica natural (mais antigo para o mais recente).

---

### 2.3. Composição de Histórico no Prompt e Métrica `historyMessages`

- **Decisão**: Implementar a composição do prompt antes da invocação da estratégia de raciocínio. Se houver histórico prévio para o `conversationId`, formatar um bloco de contexto delimitado com os turnos anteriores:
  ```text
  [Histórico da Conversa]
  User: <mensagem anterior>
  Assistant: <resposta anterior>

  [Mensagem Atual]
  <mensagem do usuário>
  ```
  A métrica `historyMessages` recebe `history.length` e é agregada ao objeto `metrics` retornado na resposta HTTP:
  ```json
  {
    "llmCalls": 2,
    "latencyMs": 420,
    "historyMessages": 5
  }
  ```
- **Rationale**:
  - Permite que qualquer estratégia (`react`, `plan-and-execute`, com ou sem `reflection`) usufrua do contexto histórico sem exigir alterações intrusivas nos nós internos do LangGraph.
  - Atende diretamente à regra do projeto: *Composição em vez de herança ou acoplamento excessivo*.
  - A métrica `historyMessages` provê observabilidade explícita sobre a profundidade de histórico utilizada na resposta.
- **Alternativas consideradas**:
  - *Passar array de BaseMessage para o LangChain diretamente*: Rejeitada para o endpoint HTTP no momento, pois o contrato atual da estratégia aceita string (`run(input: string)`). A composição textual no input mantém a compatibilidade exata com todas as estratégias registradas no `StrategyRegistry`.

---

### 2.4. Extensão Retrocompatível de `POST /chat`

- **Decisão**: 
  - `ChatRequestSchema`: aceita `conversationId: z.string().trim().min(1).optional()`.
  - Se omitido ou `undefined`: `app.ts` invoca `conversationStore.create()`.
  - `ChatResponseSchema`: adiciona obrigatoriamente `conversationId: z.string()`.
  - `ExecutionMetricsSchema`: adiciona `historyMessages: z.number().int().nonnegative()`.
  - Fluxo no controller:
    1. Resolve `conversationId` (existente ou novo via `conversationStore.create()`).
    2. Busca as últimas 12 mensagens via `conversationStore.lastMessages(conversationId, 12)`.
    3. Persiste a mensagem atual do usuário: `conversationStore.append(conversationId, "user", message)`.
    4. Compõe a entrada contextualizada com o histórico (caso `history.length > 0`).
    5. Executa a estratégia selecionada.
    6. Persiste a resposta do assistente: `conversationStore.append(conversationId, "assistant", result.answer)`.
    7. Retorna `ChatResponse` com `conversationId` e `metrics: { ...result.metrics, historyMessages }`.
- **Rationale**:
  - Preserva 100% da compatibilidade com clientes existentes que não enviam `conversationId`.
  - Assegura que toda troca de turnos seja persistida antes de responder ao cliente.

---

### 2.5. Testes Determinísticos e Isolamento (:memory: + Fake)

- **Decisão**:
  - `SqliteConversationStore` aceita caminho `:memory:` ou uma instância de `DatabaseSync` já aberta.
  - `createApp` recebe opção `conversationStore?: ConversationStore` em `AppOptions`.
  - Nos testes (`server.test.ts`), injetar um `SqliteConversationStore` conectado a `:memory:` em conjunto com o `FakeReasoningStrategy`.
- **Rationale**:
  - Nenhum teste tocará no disco `./data/opspilot.db`.
  - Velocidade sub-milisegundo e paralelismo garantido sem efeitos colaterais.

---

## 3. Resumo de Decisões e Próximos Passos

| Tópico | Escolha Adotada | Rationale Principal |
|---|---|---|
| **Driver de Banco** | `node:sqlite` (`DatabaseSync`) | Nativo Node.js 22 LTS, em conformidade com a Constituição. |
| **Identificadores** | `crypto.randomUUID()` | Nativo, sem colisões e sem dependências extras. |
| **Janela de Histórico** | 12 últimas mensagens | Equilíbrio ótimo entre contexto e janela de tokens. |
| **Composição de Prompt** | Bloco delimitado textual | Compatibilidade universal com `ReasoningStrategy.run(input)`. |
| **Isolamento de Testes** | `:memory:` em `node:test` | Rápido, determinístico e sem persistência em disco. |
