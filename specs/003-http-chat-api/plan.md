# Implementation Plan: API HTTP para Interação de Chat Operacional (`POST /chat`)

**Branch**: `003-http-chat-api` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-http-chat-api/spec.md`

## Summary

Implementação do endpoint HTTP `POST /chat` no Express v5 para recepção síncrona de comandos em linguagem natural e orquestração de estratégias da APO. O corpo da requisição é estritamente validado com Zod (`ChatRequestSchema`), selecionando por padrão a estratégia `react` ou a solicitada em `strategy`, com suporte à aplicação dinâmica do decorator `withReflection` quando `reflect === true`. A resolução de executores é centralizada em `StrategyRegistry` (`src/agents/index.ts`). A API responde com `200 OK` (`{ answer, trace, metrics }`), `400 Bad Request` para corpo inválido (detalhando issues do Zod), `422 Unprocessable Entity` para estratégias desconhecidas e `504 Gateway Timeout` caso a execução exceda o limite de 180s. A suíte de testes de integração é 100% determinística e offline, utilizando uma estratégia simulada (*fake*).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `express` (^5.2.1), `zod` (^4.5.4), `@langchain/core` (^1.2.9).

**Storage**: N/A (a comunicação HTTP opera em memória e orquestra chamadas às ferramentas da APO).

**Testing**: Runner nativo `node:test` executado com TypeScript loader (`tsx`). Testes de integração HTTP sem rede, usando porta efêmera e estratégia fake.

**Target Platform**: Servidor Node.js em ambiente Linux / macOS.

**Project Type**: Web API REST Service & Agent Orchestration.

**Performance Goals**: Latência de validação na borda < 10ms; testes de integração executados em < 2s.

**Constraints**:
- Timeout estrito de 180s configurável com retorno `504 Gateway Timeout`.
- Todas as entradas validadas via Zod na fronteira antes do domínio.
- Erros de estratégia mapeados para `422 Unprocessable Entity`.
- Testes de integração sem chamadas reais a modelos ou serviços externos.

**Scale/Scope**: Ponto de entrada HTTP do sistema OpsPilot para integrações externas.

## Constitution Check

*GATE: Avaliação contra os princípios de `.specify/memory/constitution.md`.*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | Dependências fluem `HTTP (server.ts/app.ts) → Schema (chat.ts) → Registry (agents/index.ts) → Strategy`. |
| **II. Validação na Fronteira** | ✅ APROVADO | O payload JSON é validado na entrada via `ChatRequestSchema` Zod antes de atingir os agentes. |
| **III. Erros de Domínio** | ✅ APROVADO | Falhas de validação viram `400`, estratégia ausente vira `422`, timeout vira `504`. |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Testes de integração determinísticos em `src/http/server.test.ts` sem dependência de rede. |
| **V. Observabilidade do Agente** | ✅ APROVADO | Retorno de `trace` completo e `metrics` consolidadas em todas as respostas de sucesso. |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação formal aprovada em `specs/003-http-chat-api/` antes da codificação. |
| **VII. Segurança por Padrão** | ✅ APROVADO | Nenhuma credencial trafegada fora dos canais seguros; proteção por timeout contra exaustão de conexões. |
| **VIII. Pequeno e Reversível** | ✅ APROVADO | Implementação isolada em `src/http/` e `src/schemas/chat.ts`, preservando o núcleo existente. |

## Project Structure

### Documentation (this feature)

```text
specs/003-http-chat-api/
├── spec.md              # Especificação de requisitos funcionais e cenários
├── plan.md              # Este plano de implementação técnica
├── research.md          # Decisões de Express v5, timeout e registry
├── data-model.md        # Schemas Zod e diagrama de sequência
├── quickstart.md        # Guia de validação via testes e curl
├── contracts/
│   └── chat-api-contract.md # Contrato HTTP público do endpoint POST /chat
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── http/
│   ├── app.ts           # Fábrica do Express app, middlewares, rotas e tratamento de erros
│   ├── server.ts        # Bootstrap do servidor HTTP ouvindo na porta configurada
│   └── server.test.ts   # Testes de integração HTTP com estratégia fake determinística
├── schemas/
│   └── chat.ts          # Schemas Zod (ChatRequestSchema, ChatResponseSchema, ErrorResponseSchema)
├── agents/
│   ├── index.ts         # StrategyRegistry, exportação de getStrategy e catálogo padrão
│   ├── types.ts         # Contratos e tipos de raciocínio
│   ├── react.ts         # Estratégia ReAct base
│   ├── plan-and-execute.ts # Estratégia Plan-and-Execute base
│   └── reflection.ts    # Decorator withReflection
└── index.ts             # Exportação unificada do pacote
```

**Structure Decision**: Adoção do padrão Express com separação entre configuração da aplicação (`app.ts`) e o listen de porta (`server.ts`), permitindo testes de integração instantâneos em portas randômicas com o runner nativo do Node.js.

## Complexity Tracking

*Nenhuma violação aos princípios da Constituição.* O design respeita rigorosamente as camadas e convenções já consagradas no repositório.
