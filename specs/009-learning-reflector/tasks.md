# Tasks: Refletor de Aprendizado Contínuo (`009-learning-reflector`)

**Feature**: Refletor de Aprendizado Contínuo via Structured Output, Salvaguardas de Segurança e Ferramenta `forget_preference`  
**Branch**: `009-learning-reflector`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [research.md](./research.md), [quickstart.md](./quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Definição de esquemas Zod e tipos de dados do domínio de reflexão e esquecimento.

- [X] T001 [P] Criar esquemas Zod `LearningReflectionSchema` e `ForgetPreferenceInputSchema` em `src/schemas/memory.ts`
- [X] T002 [P] Exportar novos esquemas e tipos no ponto de entrada de schemas em `src/schemas/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estrutura base de prompts, regras de discriminação e orquestração do modelo de reflexão.

**⚠️ CRITICAL**: O módulo base do refletor deve estar estruturado antes de implementar os testes e lógicas de cada história de usuário.

- [X] T003 Implementar a casca base e opções de injeção (`ReflectLearningOptions`, prompt com regras de discriminação) em `src/memory/reflector.ts`

**Checkpoint**: Fundação pronta — implementação das histórias de usuário pode começar.

---

## Phase 3: User Story 1 - Destilação Estruturada e Aprendizado Automático Pós-Resposta (Priority: P1) 🎯 MVP

**Goal**: Extração estruturada de diretrizes duráveis usando `withStructuredOutput({ hasLearning, fact })` e gravação assíncrona no `MemoryStore`.

**Independent Test**: Executar `reflectLearning` passando uma frase com preferência durável ("Prefiro chaveamento antes de reiniciar") e validar que o modelo retorna `hasLearning: true`, destila o fato em terceira pessoa e chama `memoryStore.remember`.

### Tests for User Story 1
- [X] T004 [P] [US1] Criar testes unitários para extração e persistência de fatos válidos em `src/memory/reflector.test.ts`

### Implementation for User Story 1
- [X] T005 [US1] Implementar a função `reflectLearning(userId, userMessage, options)` com `model.withStructuredOutput` e chamada a `memoryStore.remember` em `src/memory/reflector.ts`
- [X] T006 [US1] Exportar `reflectLearning` e tipos relacionados em `src/memory/index.ts`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma isolada com mocks ou modelos reais.

---

## Phase 4: User Story 2 - Salvaguardas de Segurança: Rejeição de Segredos e Pedidos Efêmeros (Priority: P2)

**Goal**: Garantir que comandos operacionais imediatos e credenciais/tokens nunca sejam aprendidos ou armazenados no banco vetorial.

**Independent Test**: Submeter mensagens de comandos pontuais ("veja alertas agora") e com segredos ("minha chave api é token_123"), comprovando que o retorno é `hasLearning: false` e nenhuma memória é gravada.

### Tests for User Story 2
- [X] T007 [P] [US2] Escrever casos de teste unitário para bloqueio de pedidos efêmeros e senhas/tokens em `src/memory/reflector.test.ts`

### Implementation for User Story 2
- [X] T008 [US2] Implementar instruções de discriminação no prompt e guardrail determinístico por regex pré-persistência em `src/memory/reflector.ts`

**Checkpoint**: Salvaguardas ativas e validadas; proteção contra poluição da base e vazamento de dados.

---

## Phase 5: User Story 3 - Ferramenta Operacional `forget_preference` (Priority: P3)

**Goal**: Disponibilizar para o agente a tool `forget_preference`, permitindo ao operador revogar uma preferência em linguagem natural via busca semântica `recall` e remoção `forget`.

**Independent Test**: Registrar uma preferência para o operador, invocar a tool com um termo semelhante e confirmar que a memória é excluída e uma mensagem descritiva de sucesso é retornada.

### Tests for User Story 3
- [X] T009 [P] [US3] Escrever testes unitários para a tool `forget_preference` (sucesso e memória inexistente) em `src/agents/tools.test.ts`

### Implementation for User Story 3
- [X] T010 [US3] Implementar a ferramenta `forget_preference` com schema Zod, `memoryStore.recall` e `memoryStore.forget` em `src/agents/tools.ts`
- [X] T011 [US3] Registrar `forget_preference` na lista `opsTools` e exportar para uso das estratégias ReAct e Plan-and-Execute em `src/agents/tools.ts`

**Checkpoint**: Ciclo completo de governança de memória habilitado via ferramenta nativa do agente.

---

## Phase 6: User Story 4 - Integração Assíncrona no Ciclo de Vida HTTP /chat (Priority: P4)

**Goal**: Acionar a reflexão de aprendizado de forma não bloqueante após a geração da resposta ao operador em `runChat`.

**Independent Test**: Fazer requisição a `POST /chat` com `userId`, verificar retorno imediato do `200 OK` e validar que em background o fato foi analisado e persistido no `MemoryStore`.

### Tests for User Story 4
- [X] T012 [P] [US4] Escrever teste de integração HTTP cobrindo o disparo assíncrono pós-resposta em `src/http/server.test.ts`

### Implementation for User Story 4
- [X] T013 [US4] Integrar chamada assíncrona não bloqueante de `reflectLearning` no fluxo de finalização de `runChat` em `src/http/run-chat.ts`

**Checkpoint**: Aprendizado contínuo ativo no fluxo principal de produção com impacto zero na latência do usuário.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificação de tipos, conformidade com a constitution e suíte de testes de regressão.

- [X] T014 [P] Validar cenários do guia de validação rápida em `specs/009-learning-reflector/quickstart.md`
- [X] T015 Executar validação de tipos estrita (`npm run typecheck`) e suíte completa de testes (`npm test`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — criação dos schemas Zod.
- **Foundational (Phase 2)**: Depende do Setup (Phase 1) — BLOQUEIA a implementação das histórias.
- **User Stories (Phase 3+)**:
  - US1 (P1 MVP): Inicia após Phase 2.
  - US2 (P2): Depende da estrutura de extração de US1 para adicionar as salvaguardas de exclusão.
  - US3 (P3): Independente do refletor, depende do `MemoryStore` pré-existente.
  - US4 (P4): Depende de US1 e US2 para integrar no `runChat`.
- **Polish (Phase 7)**: Depende da conclusão de todas as histórias.

### Parallel Opportunities

- **Setup**: `T001` e `T002` podem ser feitos sequencialmente ou em paralelo.
- **US1 & US3**: `T004` (testes do refletor) e `T009` (testes da tool `forget_preference`) podem ser desenvolvidos em paralelo por atuarem em arquivos distintos (`src/memory/` vs `src/agents/`).
- **US2 & US3**: Salvaguardas do refletor (`T008`) e criação da tool (`T010`) são independentes entre si.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1 (Setup) e Phase 2 (Foundational).
2. Implementar Phase 3 (User Story 1 - extração estruturada e gravação de fatos válidos).
3. **VALIDAR**: Executar `src/memory/reflector.test.ts` com mock/modelo para confirmar o MVP funcional.

### Incremental Delivery

1. **Incremento 1**: Refletor básico extraindo preferências duráveis e persistindo em `MemoryStore`.
2. **Incremento 2**: Salvaguardas contra segredos e comandos pontuais ativas.
3. **Incremento 3**: Tool `forget_preference` operacional no catálogo do agente.
4. **Incremento 4**: Integração assíncrona em background no endpoint `POST /chat`.
5. **Incremento 5**: `typecheck` e testes de regressão 100% verdes.
