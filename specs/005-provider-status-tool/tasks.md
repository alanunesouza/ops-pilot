# Tasks: Ferramenta de Status de Provedores Externos (`005-provider-status-tool`)

**Feature**: Ferramenta `check_provider_status`, Resiliência com Timeout/Retry e Injeção de Fetch  
**Branch**: `005-provider-status-tool`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Definição dos schemas Zod de validação na fronteira para entrada e saída das statuspages

- [X] T001 [P] Criar schemas Zod `ProviderEnumSchema`, `ProviderStatusInputSchema` e `StatuspageResponseSchema` em `src/schemas/provider-status.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Mapeamento de endpoints públicos e cliente HTTP resiliente com suporte a injeção de fetch

**⚠️ CRITICAL**: O cliente HTTP resiliente com suporte a injeção deve estar pronto antes da implementação das ferramentas da APO.

- [X] T002 Implementar cliente `queryProviderStatus` com mapeamento de endpoints públicos (`github` e `cloudflare`) e injeção de `fetchFn` em `src/agents/provider-status-client.ts`

**Checkpoint**: Fundação pronta — implementação da ferramenta e integração com o agente podem ser iniciadas.

---

## Phase 3: User Story 1 - Verificação Rápida de Saúde de Dependências Externas (Priority: P1) 🎯 MVP

**Goal**: Disponibilizar a ferramenta `check_provider_status` com suporte aos provedores `github` e `cloudflare`, valor padrão `"github"`, formato compacto de linha única e 6 regras semânticas.

**Independent Test**: Executar testes em `src/agents/tools.test.ts` verificando que a ferramenta retorna uma linha única compacta com indicador e descrição para GitHub e Cloudflare.

### Tests for User Story 1
- [X] T003 [P] [US1] Escrever testes unitários em `src/agents/tools.test.ts` cobrindo consulta padrão (`github`), consulta com provedor explícito (`cloudflare`) e formato de linha única

### Implementation for User Story 1
- [X] T004 [US1] Implementar a ferramenta LangChain `check_provider_status` aderente às 6 regras semânticas em `src/agents/tools.ts`
- [X] T005 [US1] Incluir `check_provider_status` na lista de ferramentas operacionais exportadas `opsTools` em `src/agents/tools.ts`

**Checkpoint**: User Story 1 (MVP) 100% funcional e testável de forma independente offline.

---

## Phase 4: User Story 2 - Resiliência, Timeout e Retorno Amigável de Falhas (Priority: P2)

**Goal**: Aplicar timeout estrito de 5s (`AbortSignal.timeout`), política de retry único para falhas de rede ou status HTTP 5xx, validação Zod e retorno de erro tratado como observação textual.

**Independent Test**: Executar testes simulando lentidão > 5s, erro 500 com recuperação na 2ª tentativa, falha persistente e resposta fora do schema Zod, validando que zero exceções não tratadas são lançadas.

### Tests for User Story 2
- [X] T006 [P] [US2] Escrever testes unitários em `src/agents/tools.test.ts` simulando timeout de 5s, retry em erro 5xx/rede, schema inválido e formatação de erro como observação

### Implementation for User Story 2
- [X] T007 [US2] Implementar controle de timeout de 5s, lógica de retry único e captura graciosa de falhas em `src/agents/provider-status-client.ts`

**Checkpoint**: Resiliência e tratamento de erro como observação totalmente operacionais.

---

## Phase 5: User Story 3 - Injeção de Dependência de Rede e Cobertura Offline Total (Priority: P3)

**Goal**: Disponibilizar fábrica `createCheckProviderStatusTool` permitindo injeção de `fetchFn` e assegurar que a suíte execute 100% offline sem depender de rede externa.

**Independent Test**: Executar `npm test` verificando que todos os testes rodam offline com mocks em menos de 100ms.

### Tests for User Story 3
- [X] T008 [P] [US3] Escrever testes unitários para a fábrica `createCheckProviderStatusTool` com mock de fetch customizado em `src/agents/tools.test.ts`

### Implementation for User Story 3
- [X] T009 [US3] Exportar fábrica `createCheckProviderStatusTool` com injeção de `fetchFn` em `src/agents/tools.ts`

**Checkpoint**: Testabilidade completa sem dependência de conexões de rede externas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificações finais de qualidade, validação fim-a-fim e documentação

- [X] T010 [P] Executar checagem estática de tipos via `npm run typecheck` e garantir zero erros
- [X] T011 [P] Executar a suíte completa de testes unitários e de integração via `npm test`
- [X] T012 Validar fluxo conforme `specs/005-provider-status-tool/quickstart.md`
- [X] T013 [P] Atualizar documentação em `README.md` refletindo a nova ferramenta `check_provider_status`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — execução imediata.
- **Foundational (Phase 2)**: Depende do Setup — **BLOQUEIA** todas as histórias de usuário.
- **User Story 1 (Phase 3)**: Depende da Fase Foundational — Estabelece a ferramenta e o contrato MVP.
- **User Story 2 (Phase 4)**: Depende de US1 — Incorpora timeout, retry único e tratamento de erros.
- **User Story 3 (Phase 5)**: Depende de US1 e US2 — Formaliza a fábrica injetável para testes.
- **Polish (Phase 6)**: Depende da conclusão de todas as histórias de usuário anteriores.

### Parallel Opportunities

- **US1**: `T003` (testes de sucesso) pode ser escrito antes da implementação de `T004`.
- **US2**: `T006` (testes de resiliência) pode ser escrito em paralelo ao desenvolvimento do cliente resiliente.
- **Polish**: `T010`, `T011` e `T013` podem ser executados concorrentemente.

---

## Implementation Strategy

### MVP First (User Story 1)
1. Concluir Setup (Fase 1) + Foundational (Fase 2).
2. Implementar User Story 1 (Fase 3): Ferramenta `check_provider_status` básica com saída em linha única e 6 regras.
3. Validar US1 de forma independente com testes simulados.

### Incremental Delivery
1. Adicionar US2: Implementar timeout com `AbortSignal.timeout(5000)`, retry único para 5xx/rede e erro como observação.
2. Adicionar US3: Exportar fábrica `createCheckProviderStatusTool({ fetchFn })` e consolidar suíte offline.
3. Finalizar com Polish: validação de tipos, testes completos e atualização do `README.md`.
