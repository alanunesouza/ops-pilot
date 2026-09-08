---
name: instructions
description: Diretrizes completas de arquitetura, stack técnica, convenções de código, estrutura de pastas, fluxo de desenvolvimento e política de comandos do projeto OpsPilot.
---

# OpsPilot — Guia Completo do Projeto

## Visão Geral

**OpsPilot** é um copiloto inteligente de plantão (on-call) para gestão de alertas e incidentes de produção. O núcleo do sistema é a **APO** (Agente de Produção e Operações) — um agente LLM implementado com LangChain / LangGraph, roteado via OpenRouter, capaz de receber alertas, diagnosticar problemas e sugerir ou executar ações de remediação.

---

## Stack Técnica

| Camada         | Tecnologia                                               |
|----------------|----------------------------------------------------------|
| Runtime        | Node.js 22 LTS                                           |
| Linguagem      | TypeScript ESM (`"type": "module"`, `strict: true`)      |
| Transpiler Dev | `tsx` (execução direta sem build em dev)                 |
| Agente IA      | LangChain + LangGraph via `@langchain/langgraph`         |
| Modelo LLM     | OpenRouter via `@langchain/openai`                       |
| Validação      | `zod` v4 em **toda** fronteira (HTTP, CLI, env, LLM out) |
| API HTTP       | Express v5                                               |
| Banco de Dados | MySQL via Sequelize v6                                   |
| Testes         | `node:test` nativo + `tsx` como loader                   |
| Tipagem Dev    | TypeScript v7 + `@types/node` + `@types/express`         |

---

## Estrutura de Pastas

```
ops-pilot/
├── src/
│   ├── index.ts          # Entrypoint principal (Express + servidor HTTP)
│   ├── arena.ts          # Ambiente de testes interativos do agente
│   ├── bench.ts          # Benchmarks de avaliação de qualidade do agente
│   ├── agents/           # Definições e grafos LangGraph da APO
│   ├── controllers/      # Handlers HTTP (recebe req, delega ao service, responde)
│   ├── services/         # Lógica de negócio e orquestração
│   ├── models/           # Modelos Sequelize (entidades do banco)
│   ├── schemas/          # Schemas Zod reutilizáveis
│   ├── middlewares/      # Middlewares Express (auth, error handler, logging)
│   ├── tools/            # LangChain Tools disponíveis para o agente
│   └── utils/            # Funções utilitárias puras
├── .agents/
│   └── skills/           # Skills do Spec Kit (instructions, speckit-*)
├── .env.example          # Template de variáveis de ambiente (commitar sempre)
├── .gitignore
├── AGENTS.md             # Regras operacionais do agente Antigravity
├── package.json
└── tsconfig.json
```

> **Nota:** Diretórios dentro de `src/` que ainda não existem devem ser criados conforme a feature demandar. Nunca criar arquivos fora de `src/` sem justificativa explícita.

---

## Comandos

| Comando                | O que faz                                                              |
|------------------------|------------------------------------------------------------------------|
| `npm run dev`          | Inicia a aplicação em modo dev (`tsx src/index.ts`)                    |
| `npm run arena`        | Executa o ambiente de testes interativos do agente (`tsx src/arena.ts`)|
| `npm run bench`        | Executa benchmarks de avaliação (`tsx src/bench.ts`)                   |
| `npm test`             | Roda a suíte de testes com runner nativo do Node                       |
| `npm run typecheck`    | Checagem estática de tipos (`tsc --noEmit`)                            |

> O comando de teste completo: `node --import tsx --test "src/**/*.test.ts"`

**Pré-commit obrigatório:** `npm run typecheck && npm test` — ambos devem passar com zero erros.

---

## Arquitetura MVC

O projeto segue estritamente o fluxo:

```
Request → Middleware → Controller → Service → Model/Agent → Response
```

### Regras de camada

| Camada          | Responsabilidade                                                       | Proibido                                      |
|-----------------|------------------------------------------------------------------------|-----------------------------------------------|
| **Controller**  | Receber req/res, validar entrada com Zod, delegar ao Service, formatar resposta HTTP | Conter lógica de negócio ou acessar Model diretamente |
| **Service**     | Lógica de negócio, orquestração, chamar Agent ou Model                 | Importar `req`/`res` do Express               |
| **Model**       | Definição da entidade Sequelize e queries de banco                     | Conter lógica de negócio                      |
| **Agent**       | Definição do grafo LangGraph, tools e estado                           | Acessar banco diretamente (usar Service/Tools) |
| **Middleware**  | Cross-cutting concerns: auth, logging, tratamento de erros             | Lógica de negócio específica de domínio       |

---

## Convenções de Código

### Validação
- **Obrigatória em toda fronteira**: HTTP body, query params, variáveis de ambiente, saída do LLM.
- Use `zod` para definir schemas em `src/schemas/`. Nunca duplicar schemas inline.
- Variáveis de ambiente: definir schema Zod em `src/schemas/env.ts` e exportar o objeto validado.

### Erros de Domínio
- Criar classes de erro próprias em `src/utils/errors.ts` (ex.: `AlertNotFoundError`, `AgentTimeoutError`).
- Services lançam erros de domínio; middleware de erro global os traduz para respostas HTTP adequadas.
- Nunca lançar `new Error("mensagem genérica")` em código de domínio.

### Testes
- Todo código novo deve ter ao menos **um teste** em `node:test` criado no mesmo PR.
- Arquivos de teste colocalizados: `src/services/alert.service.test.ts` ao lado de `src/services/alert.service.ts`.
- Preferir testes de comportamento (o que o código faz) sobre testes de implementação (como faz).

### TypeScript
- `strict: true` — sem exceções. Nunca usar `any` explícito; preferir `unknown` + type guard.
- Usar ESM puro: imports com extensão `.js` (ex.: `import { foo } from './utils.js'`).
- Interfaces para tipos de domínio públicos; `type` para unions, intersections e aliases.

### Funções e Imutabilidade
- Preferir funções puras; isolar efeitos colaterais nas bordas (controllers, tools do agente).
- Evitar mutação de objetos; usar spread ou `structuredClone` quando necessário.

### Secrets e Variáveis de Ambiente
- **Nunca commitar `.env`**. Manter `.env.example` sempre atualizado com todas as chaves necessárias (sem valores reais).
- Variáveis carregadas nativamente pelo Node via flag `--env-file=.env` (sem `dotenv`).

---

## Fluxo de Desenvolvimento (Spec Kit)

Todo desenvolvimento de feature segue este fluxo obrigatório:

```
/speckit-specify → /speckit-clarify (opcional) → /speckit-plan →
/speckit-checklist (opcional) → /speckit-tasks → /speckit-analyze (opcional) →
/speckit-implement → /speckit-converge
```

| Skill                   | Quando usar                                                      |
|-------------------------|------------------------------------------------------------------|
| `/speckit-specify`      | Criar/atualizar a especificação da feature                       |
| `/speckit-clarify`      | Antes do plan, para de-riscar áreas ambíguas                     |
| `/speckit-plan`         | Gerar o plano de implementação técnico                           |
| `/speckit-checklist`    | Validar completude e consistência dos requisitos                 |
| `/speckit-tasks`        | Gerar tasks ordenadas por dependência                            |
| `/speckit-analyze`      | Verificar consistência entre spec, plan e tasks                  |
| `/speckit-implement`    | Executar as tasks geradas                                        |
| `/speckit-converge`     | Avaliar o que ainda falta e adicionar tasks pendentes            |

> Todas as especificações técnicas (specs) devem ser versionadas no repositório.

---

## Política de Execução de Comandos (Agente)

### ✅ Permitidos automaticamente
- `npm run <script>` (qualquer script definido em `package.json`)
- `npm test` / `npm run test`
- `npx tsc`
- `node`
- `git status`, `git diff`, `git add`, `git commit`

### ❌ Proibidos expressamente
- `rm -rf` — risco de destruição irreversível
- `sudo` — elevação de privilégio não autorizada
- `git push --force` — reescrita destrutiva de histórico
- Leitura de `.env` no terminal (ex.: `cat .env`, `grep SECRET .env`)

### ⚠️ Requer aprovação explícita do usuário
- `git push` — nunca executar de forma autônoma
- Qualquer comando de migração de banco de dados (`sequelize db:migrate`)
- Instalação de novas dependências (`npm install <pacote>`)
