# Tasks: Persistência Real de Operações com SQLite (`004-sqlite-ops-persistence`)

**Feature**: Repositório Relacional `SqliteOpsStore` via `node:sqlite`, Novas Ferramentas e 6 Regras Semânticas  
**Branch**: `004-sqlite-ops-persistence`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuração de controle de versão e erros de domínio da aplicação

- [X] T001 Adicionar `data/` e `*.db` ao arquivo `.gitignore`
- [X] T002 [P] Criar classes de erro de domínio `IncidentNotFoundError` e `RunbookNotFoundError` em `src/utils/errors.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contrato TypeScript `OpsStore`, schemas Zod atualizados e estrutura DDL do SQLite

**⚠️ CRITICAL**: O contrato `OpsStore`, os schemas Zod e a inicialização DDL devem estar prontos antes da implementação das histórias de usuário.

- [X] T003 [P] Atualizar `src/schemas/entities.ts` incluindo `RunbookSchema`, `IncidentFilterStatusSchema` e estendendo `IncidentSchema` com `resolvedAt` e `summary` opcionais
- [X] T004 [P] Criar interface `OpsStore` e tipo `SeedResult` em `src/store/types.ts`
- [X] T005 Implementar construtor, resolução de diretório pai e DDL idempotente com 4 tabelas e restrições `CHECK` em `src/store/sqlite-ops-store.ts`

**Checkpoint**: Fundação pronta — implementação do ciclo de vida de persistência pode ser iniciada.

---

## Phase 3: User Story 1 - Persistência Durável e Gestão do Ciclo de Vida dos Incidentes (Priority: P1) 🎯 MVP

**Goal**: Armazenamento durável de serviços, alertas e ciclo de vida de incidentes (`open`, `resolved` com `resolvedAt` e `summary`) usando *prepared statements* e validação por restrições `CHECK`.

**Independent Test**: Executar testes em `src/store/sqlite-ops-store.test.ts` cobrindo inserção/abertura de incidentes, resolução com timestamp/resumo, consultas e validação de erro ao violar restrições `CHECK`.

### Tests for User Story 1
- [X] T006 [P] [US1] Escrever testes unitários em `src/store/sqlite-ops-store.test.ts` validando DDL em `:memory:`, abertura/resolução de incidentes e restrições `CHECK`

### Implementation for User Story 1
- [X] T007 [US1] Implementar prepared statements e métodos de ciclo de vida de incidentes (`openIncident`, `resolveIncident`, `getIncidentById`, `listIncidents`) em `src/store/sqlite-ops-store.ts`
- [X] T008 [US1] Implementar prepared statements para consultas de serviços e alertas (`listServices`, `listAlerts`, `getAlertById`) em `src/store/sqlite-ops-store.ts`
- [X] T009 [US1] Atualizar `InMemoryStore` em `src/store/memory.ts` para implementar o contrato atualizado de incidentes e a interface `OpsStore`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma independente em memória e disco.

---

## Phase 4: User Story 2 - Carga de Semente Idempotente e Consulta a Runbooks Operacionais (Priority: P2)

**Goal**: Execução idempotente do seed do cenário Mercadinho (5 serviços, 6 alertas e 3 runbooks) e disponibilização de consultas de runbooks por serviço.

**Independent Test**: Executar a rotina de seed repetidas vezes no teste unitário validando contagem exata constante (5 serviços, 6 alertas, 3 runbooks) e consultar runbooks para checkout, payments e auth.

### Tests for User Story 2
- [X] T010 [P] [US2] Escrever testes unitários para a semente idempotente (`seed()`), `resetStore()` e consultas de runbooks em `src/store/sqlite-ops-store.test.ts`

### Implementation for User Story 2
- [X] T011 [US2] Definir dados estáticos dos runbooks operacionais para `checkout`, `payments` e `auth-service` em `src/store/sqlite-ops-store.ts`
- [X] T012 [US2] Implementar métodos `seed()`, `resetStore()` e `getRunbookByService()` com prepared statements idempotentes em `src/store/sqlite-ops-store.ts`
- [X] T013 [US2] Atualizar `InMemoryStore` em `src/store/memory.ts` para incluir armazenamento e consulta de runbooks conforme a interface `OpsStore`
- [X] T014 [US2] Atualizar o script executável de seed em `src/scripts/seed.ts` para utilizar `SqliteOpsStore`

**Checkpoint**: Semente idempotente e catálogo de runbooks totalmente operacionais.

---

## Phase 5: User Story 3 - Expansão das Ferramentas da APO com Descrições Semânticas Estritas (Priority: P3)

**Goal**: Disponibilizar as ferramentas `list_incidents` e `consultar_runbook`, e revisar todas as ferramentas existentes (`list_alerts`, `open_incident`, `resolve_incident`) sob as 6 regras semânticas.

**Independent Test**: Executar testes em `src/agents/tools.test.ts` verificando schemas, anotações `.describe()`, filtros de status e consultas de runbook.

### Tests for User Story 3
- [X] T015 [P] [US3] Escrever testes unitários para as 5 ferramentas da APO operando sobre `:memory:` em `src/agents/tools.test.ts`

### Implementation for User Story 3
- [X] T016 [US3] Implementar novas ferramentas LangChain `list_incidents` e `consultar_runbook` aderentes às 6 regras semânticas em `src/agents/tools.ts`
- [X] T017 [US3] Revisar descrições e schemas das ferramentas existentes (`list_alerts`, `open_incident`, `resolve_incident`) aderindo estritamente às 6 regras semânticas em `src/agents/tools.ts`
- [X] T018 [US3] Exportar a lista consolidada `opsTools` com as 5 ferramentas em `src/agents/tools.ts`

**Checkpoint**: Agente equipado com 5 ferramentas ricas, seguras e semanticamente documentadas.

---

## Phase 6: User Story 4 - Isolamento em Testes e Reprodutibilidade de Benchmarks (Priority: P4)

**Goal**: Configurar injeção por composição de `SqliteOpsStore` no agente com suporte a `:memory:`, preservando o isolamento de testes e determinismo nos benchmarks.

**Independent Test**: Executar `npm test` garantindo execução 100% em memória sem gerar arquivos físicos em disco, e executar `npm run bench -- --scenario C1` com sucesso.

### Implementation for User Story 4
- [X] T019 [US4] Configurar composição e injeção do repositório em `src/agents/ops-store.ts` instanciando `SqliteOpsStore` como default
- [X] T020 [US4] Garantir compatibilidade e reset limpo do store no benchmark operacional em `src/bench.ts` e `src/bench.test.ts`

**Checkpoint**: Suíte de testes isolada e determinística, sem efeitos colaterais no sistema de arquivos.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificações finais de qualidade, validação fim-a-fim e documentação

- [X] T021 [P] Executar checagem estática de tipos via `npm run typecheck` e garantir zero erros
- [X] T022 [P] Executar a suíte completa de testes unitários e de integração via `npm test`
- [X] T023 Validar fluxo ponta-a-ponta conforme `specs/004-sqlite-ops-persistence/quickstart.md` (`npm run seed` e verificação do arquivo `./data/opspilot.db`)
- [X] T024 [P] Atualizar documentação em `README.md` refletindo o novo banco SQLite, diagrama e ferramentas da APO

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — execução imediata.
- **Foundational (Phase 2)**: Depende do Setup — **BLOQUEIA** todas as histórias de usuário.
- **User Story 1 (Phase 3)**: Depende da Fase Foundational — Estabelece o núcleo de persistência MVP.
- **User Story 2 (Phase 4)**: Depende da Fase Foundational e US1 (estrutura básica de tabelas).
- **User Story 3 (Phase 5)**: Depende de US1 e US2 (consome métodos de incidentes e runbooks).
- **User Story 4 (Phase 6)**: Depende de US3 (conecta o store final às ferramentas).
- **Polish (Phase 7)**: Depende da conclusão de todas as histórias de usuário anteriores.

### Parallel Opportunities

- **Setup**: `T001` e `T002` podem ser executados em paralelo.
- **Foundational**: `T003` e `T004` podem ser executados em paralelo.
- **US1**: `T006` (testes) pode ser escrito em paralelo a `T009` (atualização do in-memory).
- **US2**: `T010` (testes) pode ser escrito em paralelo a `T011` (dados estáticos).
- **US3**: `T015` (testes das ferramentas) pode ser escrito antes da implementação das tools.
- **Polish**: `T021`, `T022` e `T024` podem ser executados concorrentemente.

---

## Implementation Strategy

### MVP First (User Story 1)
1. Completar Setup (Fase 1) + Foundational (Fase 2).
2. Implementar User Story 1 (Fase 3): `SqliteOpsStore` com DDL, CHECKs, incidentes e testes `:memory:`.
3. Validar US1 de forma independente rodando `node --import tsx --test src/store/sqlite-ops-store.test.ts`.

### Incremental Delivery
1. Adicionar US2: Carga de semente idempotente e consulta de runbooks.
2. Adicionar US3: Implementar `list_incidents` e `consultar_runbook`, além de revisar as 3 tools existentes pelas 6 regras.
3. Adicionar US4: Conectar composição em `src/agents/ops-store.ts` e validar suite completa e benchmarks.
4. Finalizar com Polish: typecheck, testes e documentação no `README.md`.
