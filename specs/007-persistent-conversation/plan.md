# Implementation Plan: Conversa Persistente (`007-persistent-conversation`)

**Branch**: `007-persistent-conversation` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-persistent-conversation/spec.md`

## Summary

Implementação do armazenamento relacional durável de conversas e mensagens para o OpsPilot, estendendo a infraestrutura SQLite existente (`node:sqlite` via `DatabaseSync`). O sistema introduz a interface `ConversationStore` com os métodos `create()`, `append()` e `lastMessages()`, acompanhada da implementação `SqliteConversationStore` operando sobre a tabela `messages` com restrição `CHECK` para papéis e índice composto `(conversation_id, created_at)`. O endpoint `POST /chat` passa a aceitar `conversationId` opcional, gerando um novo identificador se omitido e devolvendo-o obrigatoriamente na resposta. As últimas 12 mensagens do diálogo são recuperadas e compostas contextualmente no prompt de entrada da estratégia de raciocínio, expondo a quantidade recuperada na métrica `historyMessages`. A suíte de testes utiliza instâncias isoladas em memória (`:memory:`) e `FakeReasoningStrategy`.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `node:sqlite` (nativo do Node.js 22 LTS via `DatabaseSync`), `express` (v5), `zod` (v4), `@langchain/core`.

**Storage**: SQLite relacional local (`./data/opspilot.db` configurável por `OPSPILOT_DB`) com suporte nativo a instâncias em memória (`:memory:`) para testes.

**Testing**: Runner nativo `node:test` executado com TypeScript loader (`tsx`). Testes de persistência e integração HTTP rodando sobre conexões isoladas em `:memory:` com estratégias simuladas (`FakeReasoningStrategy`).

**Target Platform**: Servidor Node.js em ambiente Linux / macOS.

**Project Type**: Persistência de Diálogo, API HTTP e Composição de Prompt para Copiloto de IA.

**Performance Goals**: Recuperação de histórico em < 5ms; processamento de requisição com injeção de contexto sem overhead perceptível de latência; suíte de testes executando em < 2s.

**Constraints**:
- Uso estrito da API nativa `DatabaseSync` (`node:sqlite`) sem bibliotecas ORM externas.
- 100% das instruções SQL parametrizadas via *prepared statements*.
- Restrição `CHECK (role IN ('user', 'assistant', 'system'))` no schema da tabela `messages`.
- Composição das mensagens anteriores limitada às 12 mais recentes para controle de janela de contexto.
- Retrocompatibilidade total com clientes de `POST /chat` que não forneçam `conversationId`.

**Scale/Scope**: Gestão persistente de histórico conversacional multi-turnos para o endpoint HTTP e agentes operacionais.

## Constitution Check

*GATE: Avaliação contra os princípios de `specs/constitution.md`.*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | O controller HTTP delega persistência para `ConversationStore` e execução para `ReasoningStrategy`. Estratégias recebem o prompt composto sem acoplamento direto com banco. |
| **II. Validação na Fronteira** | ✅ APROVADO | `ChatRequestSchema`, `ChatResponseSchema` e `ExecutionMetricsSchema` são validados com `zod` em `src/schemas/chat.ts`. |
| **III. Erros de Domínio** | ✅ APROVADO | Falhas de banco e argumentos inválidos são tratados e convertidos em códigos HTTP adequados (400, 422, 500). |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Testes automatizados em `node:test` cobrindo unidade de persistência e integração HTTP rodando sobre `:memory:`. |
| **V. Segurança por Padrão** | ✅ APROVADO | Prepared statements em 100% das inserções e consultas SQL da tabela `messages`. |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação em `specs/007-persistent-conversation/spec.md` completa e validada com checklist de qualidade. |
| **VII. Pequeno e Reversível** | ✅ APROVADO | Mudança incremental: tabela `messages` isolada, interface `ConversationStore` coesa e campo `conversationId` opcional. |
| **VIII. Observabilidade do Agente** | ✅ APROVADO | Métrica explícita `historyMessages` adicionada em `ExecutionMetrics` registrando quantas mensagens históricas alimentaram o prompt. |

## Project Structure

### Documentation (this feature)

```text
specs/007-persistent-conversation/
├── spec.md              # Especificação de requisitos funcionais e cenários
├── plan.md              # Este plano de implementação técnica
├── research.md          # Decisões sobre schema de mensagens, ordenação e composição
├── data-model.md        # Esquema relacional DDL, diagramas ER e mapeamento Zod
├── quickstart.md        # Guia de validação automatizada e manual
├── contracts/
│   ├── conversation-store-contract.md # Contrato da interface ConversationStore
│   └── chat-api-contract.md           # Contrato atualizado de POST /chat
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── schemas/
│   ├── chat.ts                     # Atualização de ChatRequest, ChatResponse e ExecutionMetrics
│   └── conversation.ts             # Schemas Zod de Message e MessageRole
├── store/
│   ├── types.ts                    # Definição da interface ConversationStore e ConversationMessage
│   ├── sqlite-conversation-store.ts     # Implementação SQLite via node:sqlite (DatabaseSync)
│   ├── sqlite-conversation-store.test.ts# Testes unitários do store de conversa em :memory:
│   └── index.ts                    # Exportações unificadas de persistência
├── http/
│   ├── app.ts                      # Atualização do endpoint /chat com injeção de ConversationStore
│   ├── prompt-composer.ts          # Composição do prompt com as 12 últimas mensagens
│   └── server.test.ts              # Testes de integração HTTP cobrindo multi-turnos e métricas
```

**Structure Decision**: A implementação de `SqliteConversationStore` como componente dedicado (podendo compartilhar o mesmo arquivo de banco `OPSPILOT_DB` ou conexão) mantém a separação de responsabilidades em relação ao `SqliteOpsStore` (que cuida de serviços, alertas e incidentes operacionais).

## Complexity Tracking

*Nenhuma violação aos princípios da Constituição.* A reutilização do `node:sqlite` nativo mantém zero dependências externas adicionadas, preserva a simplicidade operacional e viabiliza execução isolada e rápida em testes.
