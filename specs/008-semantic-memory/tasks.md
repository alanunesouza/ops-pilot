# Tasks: Memória Semântica do Operador (`008-semantic-memory`)

**Feature**: Memória Semântica Vetorial por Operador (`userId`), Deduplicação > 0.92, Recall Top-3 e Injeção no Chat  
**Branch**: `008-semantic-memory`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalação de dependências vetoriais, definição de schemas Zod e interfaces de memória.

- [X] T001 Instalar dependência `@huggingface/transformers` no package.json
- [X] T002 [P] Definir tipos e interfaces (`MemoryRecord`, `RememberResult`, `RecallResult`, `MemoryStore`) em `src/memory/types.ts`
- [X] T003 [P] Atualizar `ChatRequestSchema` em `src/schemas/chat.ts` com o campo opcional `userId`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pipeline local de embeddings com lazy singleton e tabela SQLite `memories` com armazenamento em BLOB.

**⚠️ CRITICAL**: O módulo de embeddings e a tabela relacional devem estar operacionais antes da implementação das histórias de usuário.

- [X] T004 Implementar o módulo lazy singleton de embeddings (`all-MiniLM-L6-v2`, `pooling: "mean"`, `normalize: true`) e utilitário de produto escalar em `src/memory/embeddings.ts`
- [X] T005 Implementar construtor, DDL idempotente da tabela `memories` e índice por `user_id` em `src/memory/memory-store.ts`

**Checkpoint**: Fundação pronta — implementação dos métodos de memória e deduplicação pode ser iniciada.

---

## Phase 3: User Story 1 - Armazenamento e Deduplicação Semântica de Fatos do Operador (Priority: P1) 🎯 MVP

**Goal**: Gravação de memórias associadas ao `userId` em formato binário BLOB com deduplicação semântica automática para similaridade > 0.92.

**Independent Test**: Executar testes em `src/memory/memory-store.test.ts` cobrindo inserção de fato e verificação de descarte de fato semanticamente duplicado (> 0.92).

### Tests for User Story 1
- [X] T006 [P] [US1] Criar testes unitários para inicialização DDL e método `remember` com deduplicação em `src/memory/memory-store.test.ts`

### Implementation for User Story 1
- [X] T007 [US1] Implementar o método `remember(userId, fact)` com cálculo de similaridade e deduplicação > 0.92 em `src/memory/memory-store.ts`
- [X] T008 [US1] Implementar serialização e desserialização de embeddings binários em colunas BLOB em `src/memory/memory-store.ts`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma independente em memória e disco.

---

## Phase 4: User Story 2 - Recuperação Semântica por Similaridade e Esquecimento de Memórias (Priority: P2)

**Goal**: Busca vetorial semântica via produto escalar dos top-3 fatos com score >= 0.3 e exclusão de memórias via `forget`.

**Independent Test**: Consultar fatos com `recall`, validar ordenação decrescente por score e threshold de 0.3; excluir um fato com `forget` e validar ausência no `recall`.

### Tests for User Story 2
- [X] T009 [P] [US2] Criar testes unitários para `recall` (top-3, min 0.3) e `forget` em `src/memory/memory-store.test.ts`

### Implementation for User Story 2
- [X] T010 [US2] Implementar o método `recall(userId, query, limit = 3)` com filtro de pontuação mínima de 0.3 em `src/memory/memory-store.ts`
- [X] T011 [US2] Implementar o método `forget(userId, memoryId)` para exclusão de memória no banco em `src/memory/memory-store.ts`

**Checkpoint**: Consulta semântica com threshold e gerenciamento de ciclo de vida de memórias operacionais.

---

## Phase 5: User Story 3 - Injeção de Contexto Semântico no Endpoint HTTP /chat (Priority: P3)

**Goal**: Injetar bloco de memórias relevantes no prompt do agente quando `userId` for enviado em `POST /chat`.

**Independent Test**: Fazer requisição a `POST /chat` com `userId`, verificando que fatos gravados são incluídos no contexto semântico do prompt antes da execução da estratégia.

### Tests for User Story 3
- [X] T012 [P] [US3] Escrever testes de integração em `src/http/server.test.ts` validando injeção de memórias semânticas quando `userId` é fornecido
- [X] T013 [US3] Atualizar `src/http/prompt-composer.ts` para formatar e incluir o bloco `[Memórias do Operador]` no prompt
- [X] T014 [US3] Integrar busca de memórias via `memoryStore.recall` no fluxo de `runChat` em `src/http/run-chat.ts` quando `userId` estiver presente
- [X] T015 [US3] Permitir injeção opcional de `MemoryStore` em `createApp` (`AppOptions`) em `src/http/app.ts`

**Checkpoint**: Endpoint HTTP `/chat` personalizado e ciente das preferências e memórias de cada operador.

---

## Phase 6: User Story 4 - Recuperação Semântica sem Palavras em Comum (Priority: P4)

**Goal**: Comprovar que o `recall` encontra fatos semanticamente relacionados mesmo quando não compartilham nenhuma palavra léxica com a query.

**Independent Test**: Executar teste determinístico em `src/memory/memory-store.test.ts` validando recuperação sem palavras compartilhadas.

### Tests for User Story 4
- [X] T016 [US4] Escrever teste unitário explícito validando recuperação semântica sem nenhuma palavra em comum em `src/memory/memory-store.test.ts`

**Checkpoint**: Eficácia semântica do modelo vetorial validada com prova de equivalência não léxica.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Exportações públicas do módulo, validação do guia quickstart e testes de regressão.

- [X] T017 [P] Exportar a infraestrutura de memória em `src/memory/index.ts`
- [X] T018 [P] Validar cenários do guia de validação rápida em `specs/008-semantic-memory/quickstart.md`
- [X] T019 Executar validação de tipos estrita (`npm run typecheck`) e suíte completa de testes (`npm test`)

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
- **User Story 2 (P2)**: Depende da estrutura de inserção e embeddings de US1.
- **User Story 3 (P3)**: Depende do método `recall` de US2 e integra ao fluxo HTTP.
- **User Story 4 (P4)**: Valida o comportamento de US2 com caso de teste sem sobreposição de termos.

### Parallel Opportunities

- **Setup (Phase 1)**: `T002` e `T003` podem ser criados em paralelo após `T001`.
- **Foundational (Phase 2)**: `T004` e `T005` podem ser desenvolvidos em paralelo (arquivos distintos).
- **US1 & US2**: Testes unitários (`T006`, `T009`) podem ser preparados com antecedência.
- **US3**: `T012` e `T013` podem ser desenvolvidos em paralelo.
- **Polish (Phase 7)**: `T017` e `T018` podem rodar em paralelo.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1 (Setup) e Phase 2 (Foundational).
2. Implementar Phase 3 (User Story 1 - `remember` com deduplicação > 0.92).
3. **VALIDAR**: Executar `src/memory/memory-store.test.ts` em `:memory:`.
4. Garantir que a geração de embeddings e inserção em BLOB com deduplicação funcione isoladamente.

### Incremental Delivery

1. **Incremento 1**: `SqliteMemoryStore` gravando fatos e deduplicando $> 0.92$.
2. **Incremento 2**: `recall` (top-3, min 0.3) e `forget` operacionais.
3. **Incremento 3**: Integração no `/chat` com `userId` e injeção do bloco de memórias.
4. **Incremento 4**: Teste de similaridade sem palavras em comum comprovando a capacidade semântica.
5. **Incremento 5**: Validação com `typecheck` e testes de regressão 100% verdes.
