# OpsPilot Constitution

## Core Principles

### I. Camadas Explícitas (NON-NEGOTIABLE)
Dependências fluem em uma única direção: `HTTP/CLI → Controller → Service → Model/Agent`.
O domínio não faz IO. O Agente (APO) não acessa banco diretamente — usa Tools que delegam a Services.
Nenhuma camada salta outra; violações são rejeitadas em review.

### II. Validação na Fronteira (NON-NEGOTIABLE)
Toda entrada externa (HTTP body, query params, variáveis de ambiente, saída do LLM) é validada com `zod` antes de virar domínio.
Schemas vivem em `src/schemas/` e são reutilizados — nunca duplicados inline.
Dado sem validação não existe no sistema.

### III. Erros são de Domínio
Falhas previsíveis viram classes de erro próprias (ex.: `AlertNotFoundError`, `AgentTimeoutError`).
Services lançam erros de domínio; middleware global na borda os traduz para status HTTP e mensagem estruturada.
Nunca lançar `new Error("mensagem genérica")` em código de domínio.

### IV. Teste é Parte da Tarefa (NON-NEGOTIABLE)
Nenhuma lógica nova entra sem teste em `node:test`. TDD é o padrão: teste escrito → aprovado → vermelho → implementar.
`npm run typecheck` e `npm test` devem estar sempre verdes antes de qualquer commit.
Testes colocalizados: `src/services/foo.service.test.ts` ao lado de `src/services/foo.service.ts`.

### V. Observabilidade do Agente
Toda ação tomada pela APO deve ser loggada com contexto suficiente para auditoria (qual alerta, qual tool, qual output, timestamp).
O agente não age silenciosamente. Em contextos de incidente, rastreabilidade não é opcional.

### VI. Spec antes de Código
Mudanças relevantes passam pelo fluxo obrigatório: `specify → plan → tasks → implement`, com revisão humana entre as fases.
Todas as especificações técnicas são versionadas em `specs/`.
Sem spec aprovada, sem código novo.

### VII. Segurança por Padrão
Sem segredos no repositório. Variáveis de ambiente via `--env-file=.env` (sem `dotenv`); `.env.example` sempre atualizado.
Ações destrutivas passam por guardrails explícitos (deny list no AGENTS.md), não pela confiança no modelo.
`git push` e migrações de banco requerem aprovação humana explícita.

### VIII. Pequeno e Reversível
Cada tarefa cabe em um commit atômico com mensagem descritiva.
PRs grandes são sinal de tarefa mal decomposta — decompor antes de implementar.
Prefira commits frequentes; evite acumular mudanças não commitadas.

## Stack Obrigatória

| Camada         | Tecnologia                                              |
|----------------|---------------------------------------------------------|
| Runtime        | Node.js 22 LTS                                          |
| Linguagem      | TypeScript ESM strict (`"type": "module"`, `NodeNext`)  |
| Agente IA      | LangChain + LangGraph via OpenRouter                    |
| Validação      | `zod` v4                                                |
| API HTTP       | Express v5                                              |
| Banco          | SQLite via `node:sqlite` (`DatabaseSync`)                |
| Testes         | `node:test` nativo + `tsx` como loader                  |

Sem desvios de stack sem spec aprovada. Novas dependências requerem justificativa explícita na spec correspondente.

**Proibidos explicitamente:** Jest, Vitest, `dotenv`, `express-validator`, hardcode de credenciais ou URLs de produção.

## Fluxo de Desenvolvimento

O fluxo Spec Kit é obrigatório para qualquer feature nova ou mudança significativa:

```
/speckit-specify → /speckit-clarify (opcional) → /speckit-plan →
/speckit-checklist (opcional) → /speckit-tasks → /speckit-analyze (opcional) →
/speckit-implement → /speckit-converge
```

Revisão humana obrigatória entre `specify`, `plan` e `implement`.
Specs geradas são armazenadas em `specs/` e versionadas no git.

## Governance

Esta Constitution tem precedência sobre todas as outras práticas, guias e preferências pessoais.
Emendas requerem: documentação da mudança, justificativa, aprovação do owner e atualização desta versão.
Todo PR deve verificar conformidade com os princípios desta Constitution antes do merge.
Complexidade adicional deve ser justificada — YAGNI é a regra padrão.
Para orientação de runtime e detalhes operacionais, consultar `.agents/skills/instructions/SKILL.md`.

**Version**: 1.1.0 | **Ratified**: 2026-09-02 | **Last Amended**: 2026-09-20
