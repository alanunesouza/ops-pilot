# Quickstart & Validation Guide: Persistência SQLite (`004-sqlite-ops-persistence`)

**Feature**: `004-sqlite-ops-persistence`
**Date**: 2026-09-20
**Status**: Completed

Este guia descreve os passos práticos para validação fim-a-fim da persistência real com SQLite e das ferramentas da APO.

---

## 1. Pré-Requisitos

- **Node.js**: Versão 22 LTS ou superior (disponibiliza nativamente `node:sqlite`).
- **Dependências**: Instaladas via `npm install`.

---

## 2. Cenários de Validação Automatizada

### Cenário A: Validação da Camada de Persistência (`sqlite-ops-store.test.ts`)
Executa testes determinísticos diretamente sobre conexões em memória (`:memory:`):

```bash
node --import tsx --test "src/store/sqlite-ops-store.test.ts"
```

**Comportamentos validados:**
1. Criação das 4 tabelas relacionais com DDL idempotente no construtor.
2. Execução da semente idempotente (5 serviços, 6 alertas, 3 runbooks) sem duplicidade em rodadas consecutivas.
3. Ciclo de vida completo do incidente: abertura (`open`) e resolução (`resolved`) com preenchimento de `resolvedAt` e `summary`.
4. Filtragem correta de incidentes (`open`, `resolved`, `all`).
5. Bloqueio estrito de valores ilegais pelas restrições `CHECK` do banco relacional (ex.: severidade `invalid-sev` ou status `invalid-status`).
6. Proteção contra SQL injection através de *prepared statements*.

---

### Cenário B: Validação das Ferramentas da APO (`tools.test.ts`)
Valida a execução das 5 ferramentas LangChain contra o store configurado em memória:

```bash
node --import tsx --test "src/agents/tools.test.ts"
```

**Comportamentos validados:**
1. `list_alerts`: retorno de alertas ativos por padrão (`firing`) e filtrados.
2. `open_incident`: abertura formal de incidente com validação Zod e gravação no store.
3. `resolve_incident`: resolução com resumo opcional e atualização de status.
4. `list_incidents`: filtragem por status (`open` padrão, `resolved`, `all`).
5. `consultar_runbook`: recuperação de runbook para serviços com procedimento e retorno amigável quando ausente.
6. Conformidade das descrições e schemas com as 6 regras semânticas.

---

### Cenário C: Suíte Completa de Testes e Checagem Estática de Tipos

```bash
npm run typecheck
npm test
```

**Critério de Aceite**: Ambos os comandos devem finalizar com status code 0 (zero erros e zero warnings de tipo).

---

## 3. Validação Manual de Persistência em Arquivo

### Teste de Criação e Reabertura do Banco Local

1. Execute o script de seed para criar e popular o banco físico em `./data/opspilot.db`:
   ```bash
   npm run seed
   ```
2. Verifique se o diretório `./data` foi criado e contém o arquivo `opspilot.db`.
3. Verifique que o `git status` não inclui a pasta `data/` (protegida pelo `.gitignore`):
   ```bash
   git status
   ```
