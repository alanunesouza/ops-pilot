# Technical Research: Persistência Real com SQLite Nativo (`node:sqlite`)

**Feature**: `004-sqlite-ops-persistence`
**Date**: 2026-09-20
**Status**: Completed

## Visão Geral

Este documento consolida as decisões técnicas, justificativas arquiteturais e alternativas avaliadas para a introdução da persistência relacional SQLite nativa no OpsPilot, sem introdução de dependências pesadas externas e mantendo total aderência à Constitution do projeto.

---

## Decisões Técnicas

### 1. Mecanismo de Banco: `node:sqlite` (`DatabaseSync`)

- **Decisão**: Utilizar exclusivamente a API nativa síncrona `DatabaseSync` provida pelo módulo `node:sqlite` do Node.js 22 LTS.
- **Racional**:
  - Disponível nativamente no Node 22 sem necessidade de pacotes externos (`npm install`), compilação nativa com `node-gyp` ou binários adicionais.
  - Execução síncrona de alto desempenho, eliminando overhead de promises desnecessárias para acesso a arquivos locais e reduzindo latência nas tools do agente.
  - Alinhado com a Emenda Constitucional v1.1.0 (substituindo Sequelize/MySQL por SQLite nativo).
- **Alternativas Consideradas**:
  - `better-sqlite3`: Excelente desempenho, porém requer dependência externa C++ compilada, aumentando o atrito em pipelines de CI e desnecessário frente à presença do `node:sqlite` no Node 22.
  - `Sequelize v6 com sqlite3`: Camada de abstração ORM pesada, complexa para um esquema de apenas 4 tabelas simples e propensa a vazamento de conexões assíncronas.

### 2. Configuração de Caminho e Isolamento de Testes

- **Decisão**: Configurar o caminho do banco através do parâmetro de construtor `dbPath?: string`, com fallback para `process.env.OPSPILOT_DB` e valor padrão `./data/opspilot.db`. Permitir explicitamente `:memory:` para testes e inicializações voláteis.
- **Racional**:
  - Suporta execução isolada em memória (`:memory:`) para os testes unitários e de integração, garantindo execução em < 1 segundo e isolamento total entre suítes.
  - Cria automaticamente a pasta `./data` se o diretório não existir antes de instanciar o arquivo de banco.
  - Protegido contra commits no Git através da inclusão de `data/` no `.gitignore`.
- **Alternativas Consideradas**:
  - Arquivo fixo temporário em `/tmp`: Introduz problemas de permissão em múltiplos sistemas operacionais e concorrência indesejada entre testes paralelos.

### 3. Integridade Relacional e Prepared Statements

- **Decisão**: Toda consulta e manipulação DML (`INSERT`, `UPDATE`, `SELECT`) utilizará *prepared statements* parametrizados (`db.prepare(...)`). O DDL de inicialização conterá restrições `CHECK` explícitas em todas as colunas de domínio finito (`tier`, `severity`, `status`).
- **Racional**:
  - **Segurança por Padrão (Princípio VII da Constitution)**: Previne categoricamente vulnerabilidades de SQL Injection.
  - **Validação Dupla**: O schema Zod valida na fronteira do código, e a restrição `CHECK` do SQLite garante integridade a nível de armazenamento (defense-in-depth).
- **Alternativas Consideradas**:
  - Concatenação direta de strings com sanitização manual: Alto risco de segurança, vulnerável a erros humanos e vetores de injeção.

### 4. Aplicação das 6 Regras de Descrição para Ferramentas do Agente

- **Decisão**: Padronizar as definições de todas as 5 ferramentas (`list_alerts`, `open_incident`, `resolve_incident`, `list_incidents`, `consultar_runbook`) no arquivo `src/agents/tools.ts` de acordo com as 6 regras semânticas:
  1. **Propósito Operacional Claro**: Declaração objetiva do que a ferramenta realiza.
  2. **Quando Usar (Gatilho)**: Casos de uso e intenções do operador que devem disparar a ferramenta.
  3. **Quando NÃO Usar (Fronteira)**: Limites explícitos e indicação da ferramenta alternativa correta.
  4. **Documentação de Campo com `.describe()`**: Cada parâmetro do schema Zod com explicação clara de seu propósito.
  5. **Tipagem e Enums Estritos**: Domínios fechados expressos via `z.enum` com valores padrão explícitos.
  6. **Formato de Retorno Previsível**: Retorno JSON serializado consistente ou mensagem amigável de erro/ausência.
- **Racional**:
  - Elimina a ambiguidade reportada no uso de `open_incident`, reduzindo invocações desnecessárias ou redundantes pela APO durante o raciocínio.
- **Alternativas Consideradas**:
  - Descrições curtas genéricas: Resultam em chamadas errôneas e alucinações de ferramentas pelo modelo.

### 5. Inversão de Dependência via Interface `OpsStore`

- **Decisão**: Definir o contrato abstrato `OpsStore` em `src/store/types.ts`. Tanto `SqliteOpsStore` quanto `InMemoryStore` implementam essa mesma interface. A fábrica de ferramentas e serviços aceita uma instância injetável de `OpsStore`, adotando `SqliteOpsStore` como default.
- **Racional**:
  - Garante total desacoplamento arquitetural (Princípio I - Camadas Explícitas).
  - Permite que testes e os cenários de baseline do benchmark (`src/bench.ts`) continuem utilizando instâncias em memória sem afetar o banco operacional.
- **Alternativas Consideradas**:
  - Acoplamento direto ao singleton do banco de dados: Impede mocking e dificulta isolamento de testes.
