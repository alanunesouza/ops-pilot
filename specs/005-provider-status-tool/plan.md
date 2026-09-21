# Implementation Plan: Ferramenta de Status de Provedores Externos (`005-provider-status-tool`)

**Branch**: `005-provider-status-tool` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-provider-status-tool/spec.md`

## Summary

Implementação da ferramenta LangChain `check_provider_status` em `src/agents/tools.ts`, permitindo à APO consultar a statuspage pública oficial de provedores externos essenciais (`github` e `cloudflare`) via API pública do statuspage.io sem chaves de autenticação. A ferramenta possui parâmetro `provider` tipado como enum (`github` ou `cloudflare`, default `"github"`), descrição estruturada pelas 6 regras semânticas (com foco em diagnosticar se o problema é interno ou externo), resiliência avançada com timeout de 5s (`AbortSignal.timeout`), uma nova tentativa em caso de falha de rede ou HTTP 5xx, validação estrita da resposta via Zod (`{ status: { indicator, description } }`), formato de retorno compacto em linha única para preservar a janela de contexto da LLM, e tratamento integral de erros convertidos em observação (sem exceções não tratadas). A função de `fetch` é injetável para permitir testes unitários 100% offline e determinísticos.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `@langchain/core` (^1.2.9), `zod` (^4.5.4), `fetch` e `AbortSignal` nativos do Node 22 LTS.

**Storage**: N/A (consulta de status externa sem persistência em banco).

**Testing**: Runner nativo `node:test` executado com TypeScript loader (`tsx`). Testes com `fetch` injetado/simulado sem uso de rede real.

**Target Platform**: Servidor Node.js em ambiente Linux / macOS.

**Project Type**: LangChain Structured Tool & Agent Integration.

**Performance Goals**: Execução de chamadas mockadas em < 10ms; timeout cancelado rigorosamente em 5000ms; resposta compacta em linha única < 150 caracteres.

**Constraints**:
- Sem dependências externas de HTTP (usar `fetch` e `AbortSignal` nativos).
- Sem dependências externas de retry ou mock.
- Zero exceções não tratadas arremessadas para fora da ferramenta (erro tratado como observação).
- Descrição da tool estritamente aderente às 6 regras semânticas.

**Scale/Scope**: Ferramenta de triagem de dependências externas para a APO.

## Constitution Check

*GATE: Avaliação contra os princípios de `.specify/memory/constitution.md` (Emenda v1.1.0).*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | A ferramenta vive em `src/agents/tools.ts` e é orquestrada pela APO como uma StructuredTool LangChain pura. |
| **II. Validação na Fronteira** | ✅ APROVADO | Tanto os parâmetros de entrada quanto os dados retornados pelas statuspages são validados com `zod`. |
| **III. Erros de Domínio** | ✅ APROVADO | Falhas de rede ou timeout são tratadas graciosamente e formatadas como observações textuais de diagnóstico. |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Testes colocalizados em `src/agents/tools.test.ts` com injeção de fetch sem tráfego de rede real. |
| **V. Observabilidade do Agente** | ✅ APROVADO | Saída compacta em linha única reportando o indicador e descrição oficial do provedor. |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação aprovada em `specs/005-provider-status-tool/` antes de qualquer alteração de código. |
| **VII. Segurança por Padrão** | ✅ APROVADO | Utiliza statuspages públicas sem chaves ou segredos de API; timeout impede exaustão de conexões. |
| **VIII. Pequeno e Reversível** | ✅ APROVADO | Adição cirúrgica em `src/agents/tools.ts` e testes correspondentes em `src/agents/tools.test.ts`. |

## Project Structure

### Documentation (this feature)

```text
specs/005-provider-status-tool/
├── spec.md              # Especificação funcional e cenários de aceitação
├── plan.md              # Este plano de implementação técnica
├── research.md          # Decisões técnicas sobre statuspages, timeout e retry
├── data-model.md        # Schemas Zod de entrada e resposta de statuspage
├── quickstart.md        # Guia de validação offline e automatizada
├── contracts/
│   └── provider-status-contract.md # Contrato semântico da ferramenta check_provider_status
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── schemas/
│   └── provider-status.ts # Schemas Zod: ProviderStatusInputSchema, StatuspageResponseSchema (ou colocalizado)
├── agents/
│   ├── tools.ts           # Adição de check_provider_status e createCheckProviderStatusTool
│   └── tools.test.ts      # Testes unitários de check_provider_status com fetch simulado
└── index.ts               # Exportação unificada do projeto
```

**Structure Decision**: Inclusão direta da ferramenta em `src/agents/tools.ts` e seus schemas em `src/schemas/entities.ts` (ou arquivo próprio) com fábrica injetável para manter o padrão existente do projeto.

## Complexity Tracking

*Nenhuma violação aos princípios da Constituição.* A funcionalidade aproveita as APIs nativas do Node 22 (`fetch` e `AbortSignal.timeout`) sem adicionar dependências ou pacotes de terceiros.
