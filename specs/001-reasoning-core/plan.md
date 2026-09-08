# Implementation Plan: Núcleo de Raciocínio do OpsPilot

**Branch**: `001-reasoning-core` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-reasoning-core/spec.md`

## Summary

Implementação da espinha dorsal cognitiva da APO (Agente de Produção e Operações) do OpsPilot. O sistema define um contrato padronizado `ReasoningStrategy` que emite respostas, traces tipados (`thought`, `action`, `observation`, `plan`, `critique`, `answer`) e métricas (`llmCalls`, `latencyMs`). Fornece uma fábrica de modelo centralizada para OpenRouter (temperatura 0), ferramentas operacionais padronizadas com Zod (`list_alerts`, `open_incident`, `resolve_incident`) sobre store in-memory pré-populado com seed inicial (5 serviços, 6 alertas: 3 firing, 3 resolved), e duas estratégias cognitivas: ReAct (LangGraph prebuilt) e Plan-and-Execute (grafo com planner, executor e replanner limitado a 8 passos). Uma CLI de Arena (`src/arena.ts`) compara as estratégias e suíte de testes determinísticos garante integridade sem dependência de rede.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `@langchain/langgraph` (^1.4.13), `@langchain/openai` (^1.5.11), `@langchain/core` (^1.2.9), `zod` (^4.5.4), `sequelize` (^6.37.8).

**Storage**: Store in-memory singleton em `src/store/memory.ts` para execuções da Arena e testes locais rápidos; schemas e modelos preparados para persistência relacional MySQL via Sequelize.

**Testing**: Runner nativo `node:test` executado com TypeScript loader (`tsx`). 100% determinístico e sem chamadas de rede externas.

**Target Platform**: Servidor / CLI Node.js em ambiente Linux / macOS.

**Project Type**: AI Agent Reasoning Engine & CLI Arena.

**Performance Goals**: Tempo de overhead do agente < 50ms além do tempo de resposta da LLM; suíte de testes unitários executada em < 5 segundos.

**Constraints**:
- Temperatura determinística `0` em todas as chamadas de modelo.
- Limite máximo estrito de 8 passos na estratégia Plan-and-Execute.
- Limite de iterações configurável em todas as estratégias.
- Nenhuma secret hardcoded; variáveis lidas nativamente via `process.env`.
- Toda entrada externa e parâmetros de ferramentas validados via `zod`.

**Scale/Scope**: 5 serviços pré-configurados, 6 alertas iniciais (3 firing, 3 resolved), 2 estratégias de raciocínio (`react` e `plan-and-execute`), 3 ferramentas operacionais principais.

## Constitution Check

*GATE: Avaliação contra os princípios de `.specify/memory/constitution.md`.*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | Dependências fluem `CLI/Arena → Strategy → Tool/Service → Store/Model`. O agente não acessa banco diretamente, usa as tools padronizadas. |
| **II. Validação na Fronteira** | ✅ APROVADO | Schemas Zod em `src/schemas/` validam serviços, alertas, incidentes e todos os inputs/outputs das tools. |
| **III. Erros de Domínio** | ✅ APROVADO | Classes de erro explícitas; tools tratam erros previsíveis retornando feedback legível para a LLM. |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Testes colocalizados em `node:test` cobrindo store, ferramentas e traces de forma determinística sem rede. |
| **V. Observabilidade do Agente** | ✅ APROVADO | Traces completos emitidos com eventos tipados (`thought`, `action`, `observation`, `plan`, `critique`, `answer`) e métricas (`llmCalls`, `latencyMs`). |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação formal versionada em `specs/001-reasoning-core/` antes da geração de tarefas e implementação. |
| **VII. Segurança por Padrão** | ✅ APROVADO | Nenhuma credencial no repositório. Variáveis carregadas nativamente. Ações destrutivas bloqueadas por guardrails. |
| **VIII. Pequeno e Reversível** | ✅ APROVADO | Arquitetura modular e componentizada em arquivos concisos de responsabilidade única. |

## Project Structure

### Documentation (this feature)

```text
specs/001-reasoning-core/
├── spec.md              # Especificação de requisitos funcionais e critérios de sucesso
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais e justificativas
├── data-model.md        # Entidades de dados, schemas Zod e diagramas de estado
├── quickstart.md        # Guia de validação prática e cenários executáveis
├── contracts/           # Contratos públicos da feature
│   ├── strategy-contract.md
│   ├── tools-contract.md
│   └── arena-cli-contract.md
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── agents/
│   ├── types.ts              # Interface ReasoningStrategy, TraceEvent e ExecutionMetrics
│   ├── model.ts              # Fábrica única de ChatOpenAI configurada para OpenRouter (temp 0)
│   ├── tools.ts              # Ferramentas list_alerts, open_incident, resolve_incident com Zod
│   ├── react.ts              # Estratégia ReAct usando LangGraph prebuilt com captura de trace
│   ├── plan-and-execute.ts   # Estratégia Plan-and-Execute (planner, executor, replanner, max 8 passos)
│   ├── trace.ts              # Formatador e helpers de serialização/cálculo de métricas de trace
│   ├── tools.test.ts         # Testes unitários das ferramentas
│   └── trace.test.ts         # Testes unitários de formatação de trace e métricas
├── schemas/
│   ├── entities.ts           # Schemas Zod para Service, Alert, Incident e enums
│   └── env.ts                # Schema Zod para validação de variáveis de ambiente
├── store/
│   ├── memory.ts             # Store in-memory singleton pré-populado com seed
│   └── memory.test.ts        # Testes unitários do store e operações de alertas/incidentes
├── scripts/
│   └── seed.ts               # Script executável para rodar e auditar o seed primário
├── arena.ts                  # CLI da Arena com flags --strategies e --max-iterations
└── index.ts                  # Entrypoint do sistema
```

## Complexity Tracking

*Nenhuma violação aos princípios da Constituição foi introduzida.* A arquitetura segue estritamente as diretrizes de modularidade, tipagem estrita e testes nativos.
