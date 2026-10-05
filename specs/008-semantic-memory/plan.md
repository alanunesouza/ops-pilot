# Implementation Plan: Memória Semântica do Operador (`008-semantic-memory`)

**Branch**: `008-semantic-memory` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-semantic-memory/spec.md`

## Summary

Implementação da camada de memória semântica vetorial particionada por usuário (`userId`) para o OpsPilot. O sistema introduz a biblioteca `@huggingface/transformers` com o modelo `all-MiniLM-L6-v2` (`pooling: "mean"`, `normalize: true`) encapsulado em um *lazy singleton* em `src/memory/embeddings.ts`. A persistência relacional é gerenciada por `SqliteMemoryStore` em `src/memory/memory-store.ts` sobre a tabela `memories` no SQLite (`id`, `user_id`, `fact`, `embedding BLOB`, `created_at`). O método `remember` realiza deduplicação semântica quando a similaridade com um fato prévio do mesmo usuário ultrapassa `0.92`. O método `recall` calcula o produto escalar direto sobre os vetores em formato binário `Float32Array`, retornando os top-3 fatos com score mínimo de `0.3`. O método `forget` permite remoção. O endpoint `POST /chat` passa a aceitar `userId` opcional, injetando automaticamente as memórias relevantes no prompt do agente. Testes automatizados cobrem a recuperação de fatos sem sobreposição de palavras-chave sobre conexões `:memory:`.

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `@huggingface/transformers` (para embeddings locais ONNX), `node:sqlite` (`DatabaseSync`), `zod` (v4), `express` (v5).

**Storage**: SQLite relacional local (`./data/opspilot.db` configurável por `OPSPILOT_DB`) com armazenamento de vetores em colunas `BLOB` binárias (`Float32Array`), suportando `:memory:` para testes.

**Testing**: Runner nativo `node:test` executado com `tsx`.

**Target Platform**: Servidor Node.js em ambiente Linux / macOS.

**Project Type**: Memória Semântica Vetorial Local e Injeção de Contexto para Agente de IA.

**Performance Goals**: Cálculo vetorial e busca em < 10ms para 100 memórias; lazy loading do modelo de embeddings sem atrasar o boot do servidor.

**Constraints**:
- Modelo local executado via `@huggingface/transformers` sem dependência de APIs externas de embeddings.
- Normalização unitária (`normalize: true`) para que produto escalar seja numericamente idêntico à similaridade de cosseno.
- Deduplicação semântica estrita para score $> 0.92$.
- Limiar de relevância mínima $\ge 0.3$ no `recall`.
- Compatibilidade retroativa no `/chat` quando `userId` não for informado.

## Constitution Check

*GATE: Avaliação contra os princípios de `specs/constitution.md`.*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | A memória semântica reside em `src/memory/` isolada de HTTP e modelos; `runChat` orquestra a injeção sem acoplamento indevido. |
| **II. Validação na Fronteira** | ✅ APROVADO | `userId` validado com `zod` em `ChatRequestSchema` na borda de entrada. |
| **III. Erros de Domínio** | ✅ APROVADO | Erros de formato ou parâmetros tratados sem quebrar a execução global. |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Teste unitário comprovando recuperação semântica sem palavras em comum rodando em `node:test`. |
| **V. Segurança por Padrão** | ✅ APROVADO | Modelo roda 100% localmente sem envio de dados ou fatos do operador para serviços externos de terceiros; prepared statements em 100% das operações SQL. |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação aprovada e registrada em `specs/008-semantic-memory/spec.md`. |
| **VII. Pequeno e Reversível** | ✅ APROVADO | Tabela `memories` isolada; inclusão opcional de `userId` que não quebra fluxos existentes. |
| **VIII. Observabilidade do Agente** | ✅ APROVADO | Fatos injetados ficam visíveis no bloco de contexto montado para o modelo. |

## Project Structure

### Documentation (this feature)

```text
specs/008-semantic-memory/
├── spec.md              # Especificação de requisitos funcionais e cenários
├── plan.md              # Este plano de implementação técnica
├── research.md          # Decisões sobre transformers, BLOB, pooling e produto escalar
├── data-model.md        # Esquema DDL da tabela memories e diagramas
├── quickstart.md        # Guia de validação automatizada e manual
├── contracts/
│   ├── memory-store-contract.md # Contrato da interface MemoryStore
│   └── chat-api-contract.md     # Contrato atualizado de POST /chat com userId
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── memory/
│   ├── types.ts            # Interfaces MemoryStore, MemoryRecord, RememberResult, RecallResult
│   ├── embeddings.ts       # Lazy singleton com pipeline all-MiniLM-L6-v2 de @huggingface/transformers
│   ├── memory-store.ts     # Implementação SqliteMemoryStore com remember, recall e forget
│   └── memory-store.test.ts# Testes unitários com :memory: e teste sem palavras em comum
├── schemas/
│   └── chat.ts             # Inclusão de userId opcional no ChatRequestSchema
├── http/
│   ├── prompt-composer.ts  # Suporte a bloco [Memórias do Operador] na composição
│   ├── run-chat.ts         # Orquestração do recall e injeção contextual
│   └── server.test.ts      # Testes de integração HTTP com userId
```

**Structure Decision**: A criação de `src/memory/` agrupa de forma coesa a infraestrutura vetorial e de embeddings, mantendo o domínio de memória separado do domínio de operações (`src/store/`).

## Complexity Tracking

A introdução de `@huggingface/transformers` é uma dependência nova justificada pelo requisito explícito do usuário de inferência vetorial local sem custos de rede ou dependência de serviços externos.
