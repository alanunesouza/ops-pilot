# Implementation Plan: Camada Reflection para Estratégias de Raciocínio

**Branch**: `002-reflection-layer` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-reflection-layer/spec.md`

## Summary

Implementação da camada de reflexão e auto-correção cognitiva do OpsPilot via padrão Decorator `withReflection(strategy, options)`. O decorator encapsula qualquer `ReasoningStrategy` (como `react` ou `plan-and-execute`), executa a estratégia base, submete a resposta e as observações factuais do trace a um crítico LLM com saída estruturada `{ approved: boolean, feedback: string }`. Caso haja reprovação, uma nova iteração é acionada injetando a crítica no contexto até a aprovação ou até atingir o limite `maxReflections` (default: 2). Todos os pareceres do crítico são registrados como eventos `critique` no trace, e as métricas somam as chamadas adicionais e a latência de relógio. A CLI da Arena em `src/arena.ts` passa a suportar `reflect:react` e `reflect:plan-and-execute`.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `@langchain/core` (^1.2.9), `@langchain/openai` (^1.5.11), `zod` (^4.5.4).

**Storage**: N/A (a reflexão atua na camada de orquestração cognitiva em memória).

**Testing**: Runner nativo `node:test` executado com TypeScript loader (`tsx`). Testes 100% determinísticos com mocks, sem chamadas externas de rede.

**Target Platform**: Servidor / CLI Node.js em ambiente Linux / macOS.

**Project Type**: AI Agent Cognitive Decorator & Reflection Layer.

**Performance Goals**: Overhead de avaliação crítica < 50ms além do tempo da LLM; testes unitários em < 2s.

**Constraints**:
- Parada estrita ao atingir `maxReflections` (default: 2).
- Temperatura determinística `0` em todas as avaliações críticas.
- Traces preservam eventos cronológicos sem perda de contexto entre rodadas.
- Todas as entradas e saídas do crítico validadas via `zod` com fallback resiliente.

**Scale/Scope**: Compatível com todas as estratégias do sistema (`react`, `plan-and-execute`), integrado à CLI da Arena.

## Constitution Check

*GATE: Avaliação contra os princípios de `.specify/memory/constitution.md`.*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | `withReflection` opera como decorator na camada `agents/`, respeitando o contrato `ReasoningStrategy`. |
| **II. Validação na Fronteira** | ✅ APROVADO | O parecer do crítico é tipado e validado estritamente com `CritiqueSchema` Zod. |
| **III. Erros de Domínio** | ✅ APROVADO | Falhas de parsing ou timeout no crítico possuem fallback sem interrupção catastrófica. |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Testes unitários colocalizados em `src/agents/reflection.test.ts` sem dependência de rede. |
| **V. Observabilidade do Agente** | ✅ APROVADO | Emissão explícita de eventos do tipo `critique` no `trace` e soma de chamadas em `metrics.llmCalls`. |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação formal versionada em `specs/002-reflection-layer/` antes da implementação. |
| **VII. Segurança por Padrão** | ✅ APROVADO | Nenhuma credencial trafegada fora dos canais seguros; parâmetros de execução protegidos por limites. |
| **VIII. Pequeno e Reversível** | ✅ APROVADO | Implementação isolada em módulo modular `src/agents/reflection.ts`. |

## Project Structure

### Documentation (this feature)

```text
specs/002-reflection-layer/
├── spec.md              # Especificação de requisitos funcionais e cenários
├── plan.md              # Este plano de implementação
├── research.md          # Decisões arquiteturais do crítico e decorator
├── data-model.md        # Schemas Zod (CritiqueSchema) e diagramas de estado
├── quickstart.md        # Guia de validação prática e testes locais
├── contracts/           # Contratos públicos da feature
│   └── reflection-contract.md
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── agents/
│   ├── reflection.ts         # Decorator withReflection, CritiqueSchema e loop de auto-correção
│   ├── reflection.test.ts    # Testes unitários determinísticos do decorator e crítico
│   ├── types.ts              # Exportação de ReflectionOptions e CritiqueResult
│   ├── react.ts              # Estratégia ReAct base
│   ├── plan-and-execute.ts   # Estratégia Plan-and-Execute base
│   └── trace.ts              # Utilitários de formatação de trace e métricas
└── arena.ts                  # Registro das estratégias reflect:react e reflect:plan-and-execute
```

## Complexity Tracking

*Nenhuma violação aos princípios da Constituição.* O design adota o padrão estrutural Decorator, garantindo total reutilização e acoplamento zero.
