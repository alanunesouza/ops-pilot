# Implementation Plan: Refletor de Aprendizado Contínuo (`009-learning-reflector`)

**Branch**: `009-learning-reflector` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-learning-reflector/spec.md`

## Summary

Implementação do mecanismo de aprendizado contínuo pós-resposta no OpsPilot. Após cada interação do usuário com o assistente onde `userId` estiver presente, o sistema aciona de forma assíncrona o `reflectLearning`, que utiliza `model.withStructuredOutput({ hasLearning, fact })` para analisar a última mensagem do usuário e destilar preferências e fatos duráveis (rejeitando estritamente pedidos efêmeros e senhas/segredos). Fatos válidos são persistidos no `SqliteMemoryStore` via `remember(userId, fact)`. Adicionalmente, implementa a nova ferramenta `forget_preference` integrada ao catálogo de ferramentas do agente (`opsTools`), permitindo ao operador revogar preferências aprendidas através de busca semântica (`recall`) e exclusão (`forget`).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript 7.x ESM strict (`"type": "module"`, `"moduleResolution": "NodeNext"`).

**Primary Dependencies**: `@langchain/openai`, `@langchain/core`, `zod` (v4), `express` (v5), `@huggingface/transformers` (via `src/memory`).

**Storage**: SQLite relacional e vetorial gerenciado por `SqliteMemoryStore` (`DatabaseSync` de `node:sqlite`).

**Testing**: Runner nativo `node:test` executado com loader `tsx`.

**Target Platform**: Servidor Node.js em ambiente Linux / macOS.

**Project Type**: Aprendizado Contínuo Baseado em Reflexão e Tool de Governança de Memória.

**Performance Goals**: Execução do refletor em background sem bloquear o retorno HTTP `200 OK` do chat; latência adicional perceptível no cliente = 0ms.

**Constraints**:
- Saída estritamente tipada com `model.withStructuredOutput(LearningReflectionSchema)`.
- Bloqueio terminante de segredos, senhas e chaves de acesso no fato gerado.
- Rejeição de pedidos pontuais/efêmeros (`hasLearning: false`).
- A ferramenta `forget_preference` deve localizar memórias por similaridade semântica ($\ge 0.3$) antes de remover.

## Constitution Check

*GATE: Avaliação contra os princípios de `specs/constitution.md`.*

| Princípio | Avaliação | Justificativa / Conformidade |
|---|:---:|---|
| **I. Camadas Explícitas** | ✅ APROVADO | `reflectLearning` reside em `src/memory/reflector.ts`; a ferramenta `forget_preference` reside na camada de tools e delega a `MemoryStore`. |
| **II. Validação na Fronteira** | ✅ APROVADO | Saídas do LLM validadas via Zod com `withStructuredOutput(LearningReflectionSchema)` e inputs da tool validados com `ForgetPreferenceInputSchema`. |
| **III. Erros de Domínio** | ✅ APROVADO | Falhas na reflexão assíncrona são capturadas e logadas sem comprometer a resposta ao usuário. |
| **IV. Teste é Parte da Tarefa** | ✅ APROVADO | Testes unitários para extração, salvaguardas contra segredos/pedidos pontuais e tool de exclusão em `node:test`. |
| **V. Segurança por Padrão** | ✅ APROVADO | Regra não-negociável de NUNCA persistir senhas, tokens ou segredos; defesa em profundidade no prompt e sanitização. |
| **VI. Spec antes de Código** | ✅ APROVADO | Especificação aprovada e documentada em `specs/009-learning-reflector/spec.md`. |
| **VII. Pequeno e Reversível** | ✅ APROVADO | Adição não-destrutiva que desacopla o chat do aprendizado em background. |
| **VIII. Observabilidade do Agente** | ✅ APROVADO | Operações de aprendizado e esquecimento registram logs com tags claras para auditoria. |

## Project Structure

### Documentation (this feature)

```text
specs/009-learning-reflector/
├── spec.md              # Especificação de requisitos funcionais e cenários
├── plan.md              # Este plano de implementação técnica
├── research.md          # Decisões sobre structured output, assincronicidade e salvaguardas
├── data-model.md        # Esquema Zod e diagramas de sequência de dados
├── quickstart.md        # Guia de validação automatizada e manual
├── contracts/
│   ├── learning-reflector-contract.md # Assinatura e comportamento do refletor
│   └── tool-forget-preference-contract.md # Especificação da tool forget_preference
└── checklists/
    └── requirements.md  # Checklist de qualidade da especificação
```

### Source Code (repository layout)

```text
src/
├── schemas/
│   └── memory.ts           # LearningReflectionSchema e ForgetPreferenceInputSchema
├── memory/
│   ├── reflector.ts        # Implementação de reflectLearning com withStructuredOutput
│   ├── reflector.test.ts   # Testes unitários do refletor (fatos duráveis vs pontuais vs segredos)
│   └── index.ts            # Exportação de reflectLearning e schemas
├── agents/
│   ├── tools.ts            # Implementação e registro da tool forget_preference em opsTools
│   └── tools.test.ts       # Testes da tool forget_preference (sucesso e ausência)
├── http/
│   ├── run-chat.ts         # Disparo assíncrono não bloqueante de reflectLearning pós-resposta
│   └── server.test.ts      # Teste de integração HTTP com fluxo de aprendizado
```

## Complexity Tracking

- **Novo arquivo `src/schemas/memory.ts`**: Centraliza os esquemas de validação do domínio de memória e reflexão.
- **Integração em `run-chat.ts`**: Adiciona disparo assíncrono isolado em bloco `.catch(...)` mantendo zero impacto no tempo de resposta do endpoint `/chat`.
