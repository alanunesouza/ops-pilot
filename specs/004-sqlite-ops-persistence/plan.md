# Implementation Plan: Persistência Real de Operações com SQLite (`004-sqlite-ops-persistence`)

**Branch**: `004-sqlite-ops-persistence` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-sqlite-ops-persistence/spec.md`

## Summary

Implementação do repositório relacional durável `SqliteOpsStore` (`src/store/sqlite-ops-store.ts`) baseado no módulo nativo `node:sqlite` (`DatabaseSync` do Node.js 22 LTS), unificado sob a interface `OpsStore`. O banco gerencia 4 tabelas (`services`, `alerts`, `incidents`, `runbooks`) com DDL idempotente no construtor e restrições relacionais `CHECK` estritas para domínios fechados (`tier`, `severity`, `status`). A entidade `incidents` é estendida com os campos anuláveis `resolved_at` e `summary`. A rotina de semente de dados (`seed`) é idempotente com o cenário Mercadinho de mock (5 serviços, 6 alertas e 3 runbooks operacionais). Todas as consultas utilizam *prepared statements*. A APO ganha duas novas ferramentas (`list_incidents` e `consultar_runbook`), e todas as ferramentas de `src/agents/tools.ts` são revisadas sob as 6 regras semânticas de engenharia de ferramentas. O `SqliteOpsStore` é injetado por padrão, preservando o `InMemoryStore` para cenários de benchmark e testes isolados. A pasta `data/` é adicionada ao `.gitignore`. Testes automatizados operam de forma isolada e determinística sobre `:memory:`.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `node:sqlite` (nativo do Node.js 22 via `DatabaseSync`), `@langchain/core` (^1.2.9), `zod` (^4.5.4).

**Storage**: SQLite relacional local (`./data/opspilot.db` configurável por `OPSPILOT_DB`) e SQLite em memória (`:memory:`) para testes.

**Testing**: Runner nativo `node:test` executado com TypeScript loader (`tsx`). Testes de persistência e ferramentas rodando sobre instâncias isoladas em memória (`:memory:`).

**Target Platform**: Servidor Node.js em ambiente Linux / macOS.

**Project Type**: Persistência Relacional, CLI e Ferramentas para Agentes de IA (APO).

**Performance Goals**: Execução de queries e mutações em < 5ms; suíte de testes de persistência executando em < 1s; semente idempotente executando em < 100ms.

**Constraints**:
- Uso estrito da API nativa `DatabaseSync` sem pacotes de ORM externos.
- 100% das instruções SQL parametrizadas via *prepared statements*.
- Restrições `CHECK` relacionais obrigatórias em colunas de domínio fechado.
- Proteção da pasta `data/` no `.gitignore`.
- Descrições de ferramentas formatadas estritamente sob as 6 regras de clareza cognitiva.

**Scale/Scope**: Persistência transacional local para o copiloto de plantão e repositório operacional do OpsPilot.

## Constitution Check

*GATE: Avaliação contra os princípios de `.specify/memory/constitution.md` (Emenda v1.1.0).*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | Camada de agentes não acessa SQLite diretamente; consome a interface `OpsStore` via ferramentas tipadas. |
| **II. Validação na Fronteira** | ✅ APROVADO | Todos os schemas Zod atualizados em `src/schemas/entities.ts` e nos inputs das ferramentas LangChain antes de atingir o banco. |
| **III. Erros de Domínio** | ✅ APROVADO | Exceções tratadas e mapeadas para erros específicos como `IncidentNotFoundError` e `RunbookNotFoundError`. |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Testes colocalizados em `src/store/sqlite-ops-store.test.ts` e `src/agents/tools.test.ts` usando `:memory:`. |
| **V. Observabilidade do Agente** | ✅ APROVADO | Novas ferramentas (`list_incidents`, `consultar_runbook`) e revisões das existentes sob as 6 regras geram rastreabilidade e contratos claros. |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação `specs/004-sqlite-ops-persistence/spec.md` ratificada e aprovada antes da fase de código. |
| **VII. Segurança por Padrão** | ✅ APROVADO | Prepared statements em 100% das operações SQL; pasta `data/` no `.gitignore`; sem vazamento de dados locais. |
| **VIII. Pequeno e Reversível** | ✅ APROVADO | Implementação incremental em módulos coesos com interface `OpsStore` garantindo compatibilidade regressiva com `InMemoryStore`. |

## Project Structure

### Documentation (this feature)

```text
specs/004-sqlite-ops-persistence/
├── spec.md              # Especificação de requisitos funcionais e cenários
├── plan.md              # Este plano de implementação técnica
├── research.md          # Decisões sobre node:sqlite, DDL, prepared statements e 6 regras
├── data-model.md        # Esquema relacional DDL, diagramas ER e mapeamento Zod
├── quickstart.md        # Guia prático de validação automatizada e manual
├── contracts/
│   ├── ops-store-contract.md # Contrato da interface OpsStore e métodos
│   └── tools-contract.md     # Contrato semântico das 5 ferramentas LangChain
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── schemas/
│   └── entities.ts      # Definições Zod: Service, Alert, Incident (com resolvedAt/summary), Runbook
├── store/
│   ├── types.ts         # Contrato da interface OpsStore e tipo SeedResult
│   ├── sqlite-ops-store.ts      # Implementação SQLite via node:sqlite (DatabaseSync)
│   ├── sqlite-ops-store.test.ts # Testes unitários do repositório SQLite em :memory:
│   ├── memory.ts        # Implementação InMemoryStore compatível com a interface OpsStore
│   └── memory.test.ts   # Testes unitários do store em memória
├── agents/
│   ├── ops-store.ts     # Ponto de composição/injeção do repositório operacional ativo
│   ├── tools.ts         # Ferramentas da APO: listAlerts, openIncident, resolveIncident, listIncidents, consultarRunbook
│   └── tools.test.ts    # Testes unitários das 5 ferramentas operando sobre :memory:
├── utils/
│   └── errors.ts        # Erros de domínio: IncidentNotFoundError, RunbookNotFoundError
├── scripts/
│   └── seed.ts          # Script CLI de carga de semente operacional
├── .gitignore           # Inclusão da entrada data/ e *.db
└── README.md            # Atualização da documentação de persistência e comandos
```

**Structure Decision**: A introdução de `src/store/types.ts` desacopla completamente os consumidores do armazenamento (`tools.ts`, `bench.ts`, `seed.ts`), permitindo que tanto o `SqliteOpsStore` quanto o `InMemoryStore` compartilhem a mesma assinatura estrita de métodos.

## Complexity Tracking

*Nenhuma violação aos princípios da Constituição.* A substituição de um banco externo tradicional pelo `node:sqlite` nativo simplifica a infraestrutura do projeto, reduz o consumo de recursos e elimina dependências externas desnecessárias, em conformidade com o princípio YAGNI.
