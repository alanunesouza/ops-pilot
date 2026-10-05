# Tasks: Conversa Persistente (`007-persistent-conversation`)

**Feature**: Armazenamento Relacional de Conversas com SQLite, Injeção de Histórico no Prompt e Métrica `historyMessages`  
**Branch**: `007-persistent-conversation`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Definição dos esquemas Zod e contratos de tipos compartilhados para conversação e mensagens.

- [X] T001 [P] Criar schemas Zod para mensagens de conversação (`MessageRoleSchema`, `ConversationMessageSchema`) em `src/schemas/conversation.ts`
- [X] T002 [P] Atualizar `src/schemas/chat.ts` com `conversationId` opcional em `ChatRequestSchema`, `conversationId` obrigatório em `ChatResponseSchema` e `historyMessages` em `ExecutionMetricsSchema`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contrato TypeScript `ConversationStore` e estrutura DDL relacional idempotente no SQLite.

**⚠️ CRITICAL**: O contrato `ConversationStore` e a tabela `messages` devem estar prontos antes da implementação das histórias de usuário.

- [X] T003 [P] Definir as interfaces `ConversationMessage` e `ConversationStore` em `src/store/types.ts`
- [X] T004 Implementar o construtor, DDL idempotente da tabela `messages` e índice composto `(conversation_id, created_at)` em `src/store/sqlite-conversation-store.ts`

**Checkpoint**: Fundação pronta — implementação das histórias de usuário pode ser iniciada.

---

## Phase 3: User Story 1 - Persistência Relacional de Histórico com ConversationStore (Priority: P1) 🎯 MVP

**Goal**: Gerenciamento transacional de conversas e mensagens via `ConversationStore` com os métodos `create()`, `append()` e `lastMessages()`.

**Independent Test**: Executar testes em `src/store/sqlite-conversation-store.test.ts` cobrindo criação de conversa, gravação de mensagens com papéis `user` e `assistant`, recuperação cronológica limitada e validação de erro ao violar constraint `CHECK`.

### Tests for User Story 1
- [X] T005 [P] [US1] Criar testes unitários para `SqliteConversationStore` em `src/store/sqlite-conversation-store.test.ts` validando DDL em `:memory:`, geração de UUID em `create()`, inserção via `append()` e recuperação cronológica em `lastMessages()`

### Implementation for User Story 1
- [X] T006 [US1] Implementar o método `create()` gerando UUID v4 com `crypto.randomUUID()` em `src/store/sqlite-conversation-store.ts`
- [X] T007 [US1] Implementar o método `append()` com prepared statements parametrizados para inserção na tabela `messages` em `src/store/sqlite-conversation-store.ts`
- [X] T008 [US1] Implementar o método `lastMessages()` com prepared statement recuperando as $N$ últimas mensagens em ordem cronológica crescente em `src/store/sqlite-conversation-store.ts`
- [X] T009 [US1] Exportar `SqliteConversationStore` e factory padrão em `src/store/index.ts`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma independente em memória e disco.

---

## Phase 4: User Story 2 - Rastreamento e Devolução de Sessão no Endpoint HTTP /chat (Priority: P2)

**Goal**: Suporte a `conversationId` opcional na requisição e obrigatório na resposta do endpoint `POST /chat`, garantindo a alocação de nova sessão se ausente e persistência dos turnos.

**Independent Test**: Fazer requisição HTTP sem `conversationId` validando retorno de novo identificador; em seguida fazer nova requisição com o mesmo identificador validando vinculação à mesma sessão.

### Tests for User Story 2
- [X] T010 [P] [US2] Escrever testes de integração para o ciclo de vida de `conversationId` no endpoint `/chat` em `src/http/server.test.ts`

### Implementation for User Story 2
- [X] T011 [US2] Atualizar a fábrica `createApp` em `src/http/app.ts` para aceitar injeção opcional de `ConversationStore` em `AppOptions`
- [X] T012 [US2] Integrar a resolução de `conversationId` (reuso ou criação via `conversationStore.create()`) no handler de `POST /chat` em `src/http/app.ts`
- [X] T013 [US2] Implementar persistência da mensagem do usuário e da resposta do assistente via `conversationStore.append()` em `src/http/app.ts`
- [X] T014 [US2] Garantir retorno do `conversationId` e tratamento de erros de validação Zod no payload de resposta em `src/http/app.ts`

**Checkpoint**: Endpoint `POST /chat` opera com sessões persistentes e retrocompatibilidade para clientes existentes.

---

## Phase 5: User Story 3 - Injeção de Histórico no Prompt via Composição e Métrica historyMessages (Priority: P3)

**Goal**: Injetar contextualmente as até 12 últimas mensagens no prompt da estratégia de raciocínio e retornar a métrica `historyMessages` no payload da resposta HTTP.

**Independent Test**: Disparar requisições consecutivas para a mesma conversa e verificar que o prompt contém o histórico formatado e que `metrics.historyMessages` reporta a contagem correta (limitada a 12).

### Tests for User Story 3
- [X] T015 [P] [US3] Escrever testes unitários para a função de composição de prompt em `src/http/prompt-composer.test.ts`
- [X] T016 [P] [US3] Escrever testes de integração em `src/http/server.test.ts` verificando a evolução da métrica `metrics.historyMessages` e limite de 12 mensagens

### Implementation for User Story 3
- [X] T017 [US3] Criar o utilitário de composição de prompt `composePromptWithHistory` em `src/http/prompt-composer.ts` formatando os turnos das até 12 últimas mensagens
- [X] T018 [US3] Integrar a composição de histórico e a métrica `historyMessages` na execução da estratégia em `src/http/app.ts`

**Checkpoint**: Histórico contextual injetado de forma transparente nas estratégias e métrica devidamente reportada.

---

## Phase 6: User Story 4 - Isolamento em Testes com SQLite :memory: e Estratégia Fake (Priority: P4)

**Goal**: Assegurar execução determinística, rápida e isolada da suíte de testes com banco `:memory:` e sem dependência de serviços externos.

**Independent Test**: Executar `npm test` verificando que 100% dos testes executam em `:memory:` sem tocar no sistema de arquivos e sem chamadas reais ao LLM.

### Implementation for User Story 4
- [X] T019 [US4] Configurar instâncias isoladas `:memory:` de `SqliteConversationStore` nos testes de integração em `src/http/server.test.ts`
- [X] T020 [US4] Garantir que `FakeReasoningStrategy` em `src/http/fake-strategy.ts` e `src/http/server.test.ts` opere de forma determinística com o prompt composto

**Checkpoint**: Suíte de testes 100% isolada, rápida e determinística.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificação de tipos estritos, cobertura de regressão e validação do guia quickstart.

- [X] T021 [P] Validar cenários ponta a ponta do guia de validação em `specs/007-persistent-conversation/quickstart.md`
- [X] T022 Executar checagem de tipos estrita com `npm run typecheck` e suíte completa de testes com `npm test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — execução imediata.
- **Foundational (Phase 2)**: Depende do Setup (Phase 1) — BLOQUEIA as histórias de usuário.
- **User Stories (Phase 3+)**: Dependem da conclusão da fase Foundational (Phase 2).
  - Sequência recomendada: US1 (P1 MVP) → US2 (P2) → US3 (P3) → US4 (P4).
- **Polish (Phase 7)**: Depende da conclusão de todas as histórias de usuário.

### User Story Dependencies

- **User Story 1 (P1)**: Inicia após a Fase 2 (Foundational) — sem dependência de outras histórias.
- **User Story 2 (P2)**: Depende do `ConversationStore` implementado em US1.
- **User Story 3 (P3)**: Depende do fluxo de chat em US2 e do `ConversationStore` de US1.
- **User Story 4 (P4)**: Valida o isolamento e as estratégias fake sobre US1, US2 e US3.

### Parallel Opportunities

- **Setup (Phase 1)**: `T001` e `T002` podem rodar em paralelo.
- **Foundational (Phase 2)**: `T003` pode rodar em paralelo com o rascunho de `T004`.
- **US1**: `T005` (testes) pode ser escrito antes ou em paralelo com os contratos.
- **US3**: `T015` e `T016` (testes de composição e integração) podem ser desenvolvidos em paralelo.
- **Polish (Phase 7)**: `T021` pode ser preparado em paralelo com `T022`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1 (Setup) e Phase 2 (Foundational).
2. Implementar Phase 3 (User Story 1 - `SqliteConversationStore`).
3. **VALIDAR**: Executar `src/store/sqlite-conversation-store.test.ts` em `:memory:`.
4. Garantir que a persistência relacional básica de mensagens esteja 100% verde antes de integrar ao HTTP.

### Incremental Delivery

1. **Incremento 1**: `SqliteConversationStore` funcional e testado em `:memory:`.
2. **Incremento 2**: `POST /chat` gerenciando `conversationId` de ponta a ponta.
3. **Incremento 3**: Prompt enriquecido com as 12 últimas mensagens e métrica `historyMessages`.
4. **Incremento 4**: Testes completos determinísticos isolados em `:memory:` com `FakeReasoningStrategy`.
5. **Incremento 5**: Verificação estrita de types e testes de regressão verdes.
