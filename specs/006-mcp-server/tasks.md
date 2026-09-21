# Tasks: Servidor MCP do OpsPilot (`006-mcp-server`)

**Feature**: Servidor MCP (`src/mcp/server.ts`) sobre stdio com `@modelcontextprotocol/sdk`  
**Branch**: `006-mcp-server`  
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalação do SDK MCP e centralização dos schemas canônicos para fonte única de verdade

- [X] T001 Instalar dependência `@modelcontextprotocol/sdk` no arquivo `package.json`
- [X] T002 [P] Extrair e centralizar os schemas Zod de entrada das ferramentas operacionais (`ListAlertsInputSchema`, `OpenIncidentInputSchema`, `ResolveIncidentInputSchema`) em `src/schemas/tools.ts`
- [X] T003 [P] Atualizar importações das ferramentas LangChain para consumir os schemas de `src/schemas/tools.ts` em `src/agents/tools.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estrutura base da fábrica do servidor MCP e desacoplamento do transporte para testes e produção

**⚠️ CRITICAL**: A fábrica modular do servidor e o contrato de dependência do `OpsStore` devem estar prontos antes de avançar para os handlers das user stories.

- [X] T004 Implementar fábrica modular `createOpsPilotMcpServer` com injeção opcional de `OpsStore` em `src/mcp/server.ts`

**Checkpoint**: Fundação pronta — ferramentas e transporte podem ser implementados e testados de forma desacoplada.

---

## Phase 3: User Story 1 - Descoberta e Listagem de Ferramentas Operacionais via MCP (Priority: P1) 🎯 MVP

**Goal**: Expor via protocolo MCP (`tools/list`) o catálogo com as ferramentas operacionais `list_alerts`, `open_incident` e `resolve_incident`, contendo metadados semânticos e esquemas validados.

**Independent Test**: Executar testes em `src/mcp/server.test.ts` via `InMemoryTransport.createLinkedPair()`, confirmando que `client.listTools()` lista as 3 ferramentas com identificadores e schemas compatíveis.

### Tests for User Story 1
- [X] T005 [P] [US1] Criar testes unitários para handshake de protocolo e listagem de ferramentas (`tools/list`) em `src/mcp/server.test.ts`

### Implementation for User Story 1
- [X] T006 [US1] Registrar as ferramentas `list_alerts`, `open_incident` e `resolve_incident` com schemas e descrições semânticas na fábrica em `src/mcp/server.ts`

**Checkpoint**: User Story 1 (MVP) funcional e testável de forma independente e 100% offline.

---

## Phase 4: User Story 2 - Execução de Operações de Plantão com Fonte Única de Verdade (Priority: P2)

**Goal**: Permitir que o cliente MCP execute as ferramentas operacionais (`tools/call`), integrando com o repositório de dados `OpsStore` compartilhado e validando entradas com Zod.

**Independent Test**: Executar requisições `client.callTool()` para `list_alerts`, `open_incident` e `resolve_incident` em `src/mcp/server.test.ts`, validando retornos estruturados e persistência de dados.

### Tests for User Story 2
- [X] T007 [P] [US2] Criar testes unitários para execução de `list_alerts`, `open_incident`, `resolve_incident` e tratamento de erros de execução em `src/mcp/server.test.ts`

### Implementation for User Story 2
- [X] T008 [US2] Implementar handlers de execução das ferramentas delegando para `store.listAlerts`, `store.openIncident` e `store.resolveIncident` em `src/mcp/server.ts`

**Checkpoint**: Operações completas de consulta e mutação de plantão validadas contra o `OpsStore`.

---

## Phase 5: User Story 3 - Integridade de Protocolo stdio e Isolamento de Diagnóstico em stderr (Priority: P3)

**Goal**: Assegurar estritamente que nenhuma mensagem ou log acidental polua o canal `stdout`, direcionando todos os diagnósticos e logs para `stderr`.

**Independent Test**: Executar teste de subprocesso/transporte em `src/mcp/server.test.ts` validando que `stdout` transporta exclusivamente frames válidos do protocolo MCP.

### Tests for User Story 3
- [X] T009 [P] [US3] Criar teste automatizado de integridade de transporte stdio e ausência de saídas espúrias em `stdout` em `src/mcp/server.test.ts`

### Implementation for User Story 3
- [X] T010 [US3] Configurar execução executável sobre `StdioServerTransport` e roteamento de diagnósticos para `stderr` (`console.error`) em `src/mcp/server.ts`

**Checkpoint**: Canal de comunicação stdio 100% imune a corrupção por logs arbitrários.

---

## Phase 6: User Story 4 - Inicialização Conveniente via Script NPM (Priority: P4)

**Goal**: Configurar o script de execução `mcp` no `package.json` carregando variáveis de ambiente nativamente via `--env-file=.env`.

**Independent Test**: Validar que o comando `npm run mcp` está registrado no `package.json` e aponta para `tsx --env-file=.env src/mcp/server.ts`.

### Implementation for User Story 4
- [X] T011 [US4] Adicionar script `"mcp": "tsx --env-file=.env src/mcp/server.ts"` na seção `scripts` de `package.json`

**Checkpoint**: Execução via CLI padronizada e integrada com o ecossistema do projeto.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verificações finais de qualidade, validação estática de tipos, suíte completa de testes e documentação

- [X] T012 [P] Executar checagem estática de tipos via `npm run typecheck` e garantir zero erros
- [X] T013 [P] Executar a suíte completa de testes automatizados via `npm test`
- [X] T014 Validar guia de execução e cenários ponta-a-ponta descritos em `specs/006-mcp-server/quickstart.md`
- [X] T015 [P] Atualizar documentação em `README.md` refletindo o servidor MCP do OpsPilot e instruções de configuração para clientes MCP

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — execução imediata.
- **Foundational (Phase 2)**: Depende do Setup — **BLOQUEIA** todas as user stories.
- **User Story 1 (Phase 3)**: Depende da Fase Foundational — Estabelece o catálogo e o MVP.
- **User Story 2 (Phase 4)**: Depende de US1 — Habilita execução de ferramentas contra o `OpsStore`.
- **User Story 3 (Phase 5)**: Depende de US1 e US2 — Conecta o transporte stdio com salvaguardas de `stderr`.
- **User Story 4 (Phase 6)**: Depende de US3 — Configura o script `npm run mcp`.
- **Polish (Phase 7)**: Depende da conclusão de todas as histórias anteriores.

---

## Parallel Opportunities

- **Setup**: `T002` e `T003` podem ser desenvolvidos em paralelo após `T001`.
- **Testes das User Stories**: `T005`, `T007` e `T009` podem ser preparados antes ou em paralelo com a implementação dos respectivos handlers.
- **Polish**: `T012`, `T013` e `T015` podem ser executados concorrentemente.

---

## Implementation Strategy

### MVP First (User Story 1)
1. Concluir Setup (Fase 1) + Foundational (Fase 2).
2. Implementar User Story 1 (Fase 3): Servidor MCP respondendo a `tools/list` com `list_alerts`, `open_incident` e `resolve_incident`.
3. Validar US1 de forma independente com testes mock via `InMemoryTransport`.

### Incremental Delivery
1. Adicionar US2: Implementar handlers de `tools/call` com manipulação real do `OpsStore`.
2. Adicionar US3: Configurar transporte `stdio` e regras estritas de direcionamento para `stderr`.
3. Adicionar US4: Adicionar script `npm run mcp` no `package.json`.
4. Finalizar com Polish: checagem de tipos, testes automatizados e atualização do `README.md`.
