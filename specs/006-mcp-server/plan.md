# Implementation Plan: Servidor MCP do OpsPilot (`006-mcp-server`)

**Branch**: `006-mcp-server` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Especificação de criação do servidor MCP para OpsPilot expondo ferramentas operacionais sobre `stdio`.

---

## Summary

O OpsPilot passará a fornecer um servidor compatível com o Model Context Protocol (MCP) oficial em `src/mcp/server.ts`, utilizando o pacote `@modelcontextprotocol/sdk` com transporte `stdio`. O servidor exporá o catálogo de ferramentas operacionais essenciais (`list_alerts`, `open_incident`, `resolve_incident`), reutilizando a mesma loja de dados (`OpsStore`) e os mesmos esquemas de validação Zod já estabelecidos no sistema (fonte única de verdade). O script de inicialização `npm run mcp` garantirá carregamento automático do ambiente via `--env-file=.env`, com estrito isolamento do canal de saída padrão (`stdout`), direcionando todos os diagnósticos e erros para `stderr`.

---

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).  
**Primary Dependencies**: `@modelcontextprotocol/sdk` (`^1.6.0` / `^1.30.0`), `zod` v4.  
**Storage**: `OpsStore` compartilhado (`SqliteOpsStore` em produção / `InMemoryStore` para testes em memória).  
**Testing**: `node:test` nativo com `tsx` loader, utilizando `InMemoryTransport.createLinkedPair()` para testes de integração rápidos e 100% offline.  
**Target Platform**: Processo CLI / subprocesso IPC via pipes de entrada e saída padrão (`stdio`).  
**Project Type**: Servidor de protocolo de contexto (MCP Server).  
**Performance Goals**: Tempo de resposta de `tools/list` < 250ms; tempo de execução das ferramentas < 50ms (SQLite/Memória).  
**Constraints**: **REGRA CRÍTICA**: Zero `console.log` no servidor MCP — `stdout` é canal exclusivo do protocolo serializado JSON-RPC; diagnósticos exclusivamente em `stderr`.  
**Scale/Scope**: 3 ferramentas operacionais essenciais com tipagem Zod e descrições semânticas.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Princípio 1 (Camadas Explícitas)**: PASS. O servidor MCP atua na camada de interface/transporte (`src/mcp/server.ts`), delegando operações ao `OpsStore` (`src/agents/ops-store.ts`) sem acessar o banco diretamente.
- **Princípio 2 (Validação na Fronteira)**: PASS. Todas as entradas das ferramentas MCP são validadas através dos esquemas Zod canônicos.
- **Princípio 3 (Erros são de Domínio)**: PASS. Erros capturados em chamadas de ferramentas são convertidos em mensagens informativas no protocolo MCP (`isError: true` ou texto explicativo), nunca crashando o processo.
- **Princípio 4 (Teste é parte da tarefa)**: PASS. Testes automatizados cobrindo inicialização, listagem e execução das tools usando `node:test` nativo e `InMemoryTransport`.
- **Princípio 5 (Segurança por Padrão)**: PASS. Sem segredos expostos; `--env-file=.env` carregado nativamente sem `dotenv`.
- **Princípio 6 (Spec antes de código)**: PASS. Fluxo Spec-Kit rigorosamente seguido (`spec.md` -> `plan.md` -> `tasks.md`).
- **Stack Obrigatória**: PASS. Node 22, TypeScript ESM, Zod, SQLite, `node:test`. Adição de `@modelcontextprotocol/sdk` justificada formalmente na especificação da feature.

---

## Project Structure

### Documentation (this feature)

```text
specs/006-mcp-server/
├── spec.md              # Feature specification
├── plan.md              # This file (Implementation Plan)
├── research.md          # Phase 0 research & architectural decisions
├── data-model.md        # Phase 1 data model & Zod schemas
├── quickstart.md        # Phase 1 quickstart & verification guide
├── contracts/           # Phase 1 MCP JSON-RPC protocol contracts
│   └── mcp-server-contract.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
src/
├── mcp/
│   ├── server.ts         # Servidor MCP oficial sobre stdio
│   └── server.test.ts    # Testes automatizados do servidor MCP (list_tools e call_tool)
├── schemas/
│   ├── entities.ts       # Schemas de domínio
│   └── tools.ts          # Schemas canônicos compartilhados de entrada das tools
├── agents/
│   ├── ops-store.ts      # Instância compartilhada do OpsStore
│   └── tools.ts          # Ferramentas LangChain (reutilizam src/schemas/tools.ts)
└── package.json          # Adição de @modelcontextprotocol/sdk e script "mcp"
```

**Structure Decision**:
- Criação do diretório `src/mcp/` para isolar a camada de transporte MCP.
- Extração de schemas compartilhados para `src/schemas/tools.ts` garantindo que LangChain e MCP compartilhem a exata mesma definição de parâmetros.
- Suíte de testes em `src/mcp/server.test.ts` usando `node:test` nativo.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Adição de `@modelcontextprotocol/sdk` | Implementação do protocolo padrão MCP para interoperabilidade externa com Claude Desktop, Cursor e outros agentes | Implementar JSON-RPC e especificação MCP manualmente do zero adicionaria centenas de linhas propensas a incompatibilidade com clientes oficiais |
