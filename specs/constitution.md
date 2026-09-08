# Constitution — OpsPilot

Princípios não-negociáveis que toda spec, plano, tarefa e código seguem.

## Propósito do Sistema

OpsPilot é um copiloto inteligente de plantão (on-call) para gestão de alertas e incidentes de produção. A APO (Agente de Produção e Operações) deve ser **confiável, auditável e segura** — em contextos de incidente, erros silenciosos ou ações irreversíveis são inaceitáveis.

## Princípios

1. **Camadas explícitas.** Dependências fluem `HTTP/CLI → Controller → Service → Model/Agent`. Domínio não faz IO. Agente não acessa banco diretamente — usa Tools que delegam a Services.

2. **Validação na fronteira.** Toda entrada externa (HTTP body, query params, variáveis de ambiente, saída do LLM) é validada com `zod` antes de virar domínio. Schemas vivem em `src/schemas/` e são reutilizados.

3. **Erros são de domínio.** Falhas previsíveis viram classes de erro próprias (ex.: `AlertNotFoundError`, `AgentTimeoutError`). Services lançam; middleware global traduz para status HTTP e mensagem estruturada.

4. **Teste é parte da tarefa.** Nenhuma lógica nova entra sem teste em `node:test`. `npm run typecheck` e `npm test` devem estar sempre verdes antes de qualquer commit.

5. **Segurança por padrão.** Sem segredos no repo. Ações destrutivas passam por guardrails explícitos (deny list no AGENTS.md), não pela confiança cega no modelo. `git push` e migrações de banco requerem aprovação humana.

6. **Spec antes de código.** Mudanças relevantes passam pelo fluxo: `specify → plan → tasks → implement`, com revisão humana entre as fases. Specs são versionadas em `specs/`.

7. **Pequeno e reversível.** Cada tarefa cabe em um commit atômico. PRs grandes são sinal de tarefa mal decomposta. Prefira commits frequentes com mensagens descritivas.

8. **Observabilidade do agente.** Toda ação tomada pela APO deve ser loggada com contexto suficiente para auditoria (qual alerta, qual tool, qual output). O agente não age silenciosamente.

## Stack Obrigatória

| Camada         | Tecnologia                                             |
|----------------|--------------------------------------------------------|
| Runtime        | Node.js 22 LTS                                         |
| Linguagem      | TypeScript ESM strict (`"type": "module"`, `NodeNext`) |
| Agente IA      | LangChain + LangGraph via OpenRouter                   |
| Validação      | `zod` v4                                               |
| API HTTP       | Express v5                                             |
| Banco          | MySQL via Sequelize v6                                 |
| Testes         | `node:test` nativo + `tsx` como loader                 |

> Sem desvios de stack sem spec aprovada. Novas dependências requerem justificativa explícita na spec correspondente.

## O que NÃO pertence ao projeto

- Frameworks de teste externos (Jest, Vitest) — usar `node:test` nativo.
- `dotenv` — variáveis carregadas nativamente via `--env-file=.env`.
- Lógica de negócio em controllers ou models.
- Qualquer hardcode de credencial, URL de produção ou segredo.
