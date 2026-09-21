# Feature Specification: Persistência Real de Operações com SQLite (`004-sqlite-ops-persistence`)

**Feature Branch**: `004-sqlite-ops-persistence`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Persistencia real de operacoes: -SqliteOpsStore (src/store/swqlite-ops-store.ts) implementa a interface OpsStore existente via node:sqlite (DatabaseSync); caminho em OPSPILOT_DB (default ./data/opspilot.db); \":memory:\" nos testes - 4 tabelas: services, alerts, incidents, runbooks - espelhando os tipos atuais do domínio (incidents ganha resolved_at e summary, anuláveis); DDL idempotente no constructor; CHECK em todo campo de domínio fechado (tier, severity, status) - seed idempotente = cenário Mercadinho de mock (5 serviços, 6 alertas: 3 firing, 3 resolved, runbooks de checkout/payments/auth) -prepared statements em toda query; sem SQL concatenado - tools novas: list_incidents (status open|resolved|all, default open) e consultar_runbook (service) - descricoes pelas 6 regras - composicao injeta o SqliteOpsStore; mock in memory fica para testes e para o bench (cenarios possam ser reproduzidos) - data/ no .gitignore -revisar descricoes de src/agents/tools.ts pelas 6 regras (divida do open_incident: quando usar; .describe() em todo campo; enums) - testes :memory: seed, abrir/listar/resolver, filtros e CHECKS; testes das tools existentes passam a rodar sobre :memory:"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistência Durável e Gestão do Ciclo de Vida dos Incidentes (Priority: P1) 🎯 MVP

Como operador de plantão (on-call) ou sistema automatizado de monitoramento, quero que os registros de serviços, alertas e incidentes operacionais sejam armazenados de forma transacional e durável, para que os dados do plantão persistam íntegros entre reinicializações do servidor e com garantia de integridade relacional.

**Why this priority**: Substitui o armazenamento volátil em memória por uma base transacional real, assegurando a durabilidade e integridade dos dados críticos da operação.

**Independent Test**: Inicializar o repositório de persistência, registrar um incidente operacional contendo título, serviço e severidade, reiniciar a instância do repositório reconectando ao mesmo arquivo de banco e verificar se o incidente, alertas e serviços permanecem disponíveis para consulta e atualização.

**Acceptance Scenarios**:

1. **Given** uma instância do repositório conectada a uma base persistente ou em memória, **When** um incidente é aberto com título, serviço e severidade, **Then** o incidente é gravado com identificador único, status inicial `open`, timestamps de criação e atualização.
2. **Given** um incidente em estado `open`, **When** a resolução é solicitada com resumo operacional (`summary`), **Then** o registro é atualizado para status `resolved`, recebendo a data de encerramento (`resolved_at`) e o resumo correspondente.
3. **Given** qualquer tentativa de inserção ou atualização com valores fora dos domínios fechados (ex.: severidade diferente de `low`, `medium`, `high`, `critical`), **Then** a persistência rejeita a operação com erro de integridade (`CHECK constraint`).

---

### User Story 2 - Carga de Semente Idempotente e Consulta a Runbooks Operacionais (Priority: P2)

Como engenheiro de confiabilidade e operador do plantão, quero carregar dados iniciais de serviços, alertas ativos/resolvidos e procedimentos operacionais padronizados (runbooks) de forma idempotente, para ter um ambiente operacional funcional e consultar guias de remediação para serviços críticos.

**Why this priority**: Habilita a triagem guiada por procedimentos operacionais formais (runbooks de checkout, payments e auth) e garante que execuções repetidas da aplicação ou do comando de seed não dupliquem dados.

**Independent Test**: Executar a rotina de carga de dados (seed) duas ou mais vezes consecutivas e verificar que o total de serviços (5), alertas (6: 3 `firing` e 3 `resolved`) e runbooks (3) permanece exatamente o mesmo, sem falhas de chave primária ou registros duplicados.

**Acceptance Scenarios**:

1. **Given** um banco de dados recém-criado, **When** a rotina de seed é executada, **Then** são inseridos 5 serviços, 6 alertas (3 firing, 3 resolved) e runbooks detalhados para os serviços de checkout, payments e auth.
2. **Given** um banco de dados já contendo registros previamente inseridos, **When** a rotina de seed é executada novamente, **Then** os dados existentes são mantidos ou sincronizados sem duplicidade ou erro de violação de chave primária.
3. **Given** a existência de runbooks cadastrados, **When** o operador ou o sistema consulta o runbook de um serviço existente (ex.: `payments`), **Then** o guia com as ações e comandos de diagnóstico e remediação é retornado integralmente.

---

### User Story 3 - Expansão das Ferramentas da APO com Descrições Semânticas Estritas (Priority: P3)

Como a APO (Agente de Produção e Operações), quero contar com ferramentas aprimoradas para listar incidentes (`list_incidents`) e consultar runbooks operacionais (`consultar_runbook`), com metadados semânticos completos aderentes às 6 regras de especificação de ferramentas, para decidir com precisão quando e como utilizá-las durante o plantão.

**Why this priority**: O agente inteligente depende de descrições inequívocas e contratos rigorosos para selecionar as ferramentas adequadas, evitar alucinações e agir de forma segura durante a mitigação de incidentes.

**Independent Test**: Invocar as ferramentas via chamadas tipadas do agente, validando a filtragem por status em `list_incidents`, a recuperação textual estruturada em `consultar_runbook` e a validação Zod estrita com anotações `.describe()` em todos os parâmetros.

**Acceptance Scenarios**:

1. **Given** a ferramenta `list_incidents`, **When** executada sem especificar status (comportamento padrão), **Then** retorna apenas os incidentes que estejam com status `open`.
2. **Given** a ferramenta `list_incidents`, **When** executada com `status: "resolved"` ou `status: "all"`, **Then** retorna os incidentes correspondentes àquele filtro.
3. **Given** a ferramenta `consultar_runbook`, **When** invocada com o identificador ou nome de um serviço com runbook cadastrado, **Then** retorna o conteúdo detalhado do procedimento; se o serviço não possuir runbook, retorna indicação clara de ausência sem falhar a execução.
4. **Given** a totalidade das ferramentas expostas em `src/agents/tools.ts`, **When** inspecionados seus esquemas e metadados, **Then** todas atendem às 6 regras: objetivo explícito, quando usar, quando não usar, descrições em todos os parâmetros via `.describe()`, enums estritos e especificação do formato de retorno.

---

### User Story 4 - Isolamento em Testes e Reprodutibilidade de Benchmarks (Priority: P4)

Como engenheiro de software, quero que todos os testes automatizados e o benchmark operacional possam rodar sobre instâncias isoladas em memória (`:memory:` ou mock), para assegurar execução rápida, determinística, sem concorrência de disco e sem alterar a base de dados operacional local.

**Why this priority**: Preserva a velocidade e a confiabilidade da suíte de testes (TDD) e a fidelidade dos cenários de avaliação de IA no benchmark.

**Independent Test**: Executar `npm test` garantindo que todos os testes executem em modo `:memory:`, sem criar arquivos físicos de banco no repositório, e que o diretório `data/` esteja protegido contra commits no `.gitignore`.

**Acceptance Scenarios**:

1. **Given** a suíte de testes automatizados, **When** os testes forem executados, **Then** utilizam conexões SQLite em memória (`:memory:`), validando criação de tabelas, restrições CHECK, filtros e operações de ciclo de vida sem efeitos colaterais em disco.
2. **Given** o repositório Git do projeto, **When** inspecionado o arquivo `.gitignore`, **Then** a pasta `data/` consta listada para evitar o versionamento acidental de bancos locais.
3. **Given** a composição do sistema em produção ou desenvolvimento, **When** não for explicitada variável de ambiente contrária, **Then** o caminho padrão utilizado é `./data/opspilot.db`.

---

### Edge Cases

- **Valores de domínio inválidos**: Inserção de registro com tier, severidade ou status desconhecido deve ser barrada tanto pela validação de schema Zod quanto pela restrição `CHECK` relacional do SQLite.
- **Serviço inexistente ao consultar runbook**: Se solicitada a consulta de runbook para serviço não cadastrado ou sem procedimento definido, o sistema deve retornar mensagem compreensível informando a inexistência sem gerar exceção não tratada.
- **Diretório de persistência ausente**: Se a pasta pai do arquivo de banco (ex.: `./data`) não existir no momento da inicialização, o sistema deve criá-la de forma segura antes de abrir o banco.
- **Resolução de incidente inexistente**: A tentativa de resolver um incidente com ID desconhecido deve lançar erro de domínio específico (`IncidentNotFoundError`), preservando a consistência dos dados.
- **Injeção de comandos SQL**: Toda query deve usar *prepared statements* parametrizados; entradas com caracteres de escape ou delimitadores SQL não devem alterar a estrutura da consulta.
- **Execuções simultâneas de seed**: O seed deve ser idempotente; rodar o seed repetidas vezes no mesmo banco não deve duplicar registros nem falhar com erro de integridade de chave.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE definir uma interface TypeScript unificada (`OpsStore`) estabelecendo os contratos de consulta e mutação de serviços, alertas, incidentes e runbooks.
- **FR-002**: O sistema DEVE fornecer a classe `SqliteOpsStore` (em `src/store/sqlite-ops-store.ts`) implementando a interface `OpsStore` utilizando exclusivamente a API nativa `node:sqlite` (`DatabaseSync`).
- **FR-003**: O caminho do banco de dados DEVE ser configurável pela variável de ambiente `OPSPILOT_DB`, utilizando `./data/opspilot.db` como valor padrão e aceitando `:memory:` para execução isolada em memória.
- **FR-004**: O repositório DEVE gerenciar 4 tabelas relacionais com DDL idempotente (`CREATE TABLE IF NOT EXISTS`) executado na inicialização:
  - `services` (id TEXT PRIMARY KEY, name TEXT UNIQUE, description TEXT, tier TEXT)
  - `alerts` (id TEXT PRIMARY KEY, service TEXT, title TEXT, severity TEXT, status TEXT, timestamp TEXT)
  - `incidents` (id TEXT PRIMARY KEY, title TEXT, service TEXT, severity TEXT, status TEXT, created_at TEXT, updated_at TEXT, resolved_at TEXT, summary TEXT)
  - `runbooks` (id TEXT PRIMARY KEY, service TEXT UNIQUE, title TEXT, content TEXT, created_at TEXT, updated_at TEXT)
- **FR-005**: O esquema de banco DEVE implementar cláusulas `CHECK` obrigatórias para os domínios fechados:
  - `tier IN ('tier-1', 'tier-2', 'tier-3')`
  - `severity IN ('low', 'medium', 'high', 'critical')`
  - `alerts.status IN ('firing', 'resolved')`
  - `incidents.status IN ('open', 'resolved')`
- **FR-006**: A tabela `incidents` e o modelo de domínio correspondente DEVEM incorporar os campos anuláveis `resolved_at` e `summary`.
- **FR-007**: Toda e qualquer instrução SQL DEVE utilizar *prepared statements* com parâmetros nomeados ou posicionais, sendo terminantemente vedada a concatenação de strings para montagem de queries.
- **FR-008**: O sistema DEVE fornecer rotina de semente de dados (`seed`) idempotente contendo:
  - 5 serviços (`auth-service`, `payment-gateway`, `order-api`, `inventory-service`, `notification-hub`).
  - 6 alertas (3 com status `firing` e 3 com status `resolved`).
  - 3 runbooks operacionais (procedimentos para `checkout`, `payments` e `auth`).
- **FR-009**: O sistema DEVE implementar duas novas ferramentas LangChain para o agente:
  - `list_incidents`: aceita parâmetro opcional `status` (`open`, `resolved`, `all`), assumindo `"open"` como padrão.
  - `consultar_runbook`: aceita parâmetro obrigatório `service` e retorna o procedimento de mitigação correspondente.
- **FR-010**: Todas as ferramentas do agente em `src/agents/tools.ts` (tanto as novas quanto as já existentes `list_alerts`, `open_incident`, `resolve_incident`) DEVEM seguir rigorosamente as 6 regras de documentação de ferramentas:
  1. Descrição clara e concisa do objetivo.
  2. Definição explícita de quando utilizar a ferramenta.
  3. Definição explícita de quando NÃO utilizar a ferramenta.
  4. Anotação semântica obrigatória em cada campo de entrada utilizando `.describe()`.
  5. Uso explícito de tipos restritivos e enums com valores aceitos e defaults.
  6. Formato de retorno tipado e previsível.
- **FR-011**: A camada de composição do agente e das ferramentas DEVE receber o `SqliteOpsStore` como store principal, mantendo a implementação `InMemoryStore` disponível para testes determinísticos rápidos e reprodução de cenários de benchmark.
- **FR-012**: O arquivo `.gitignore` DEVE conter a entrada `data/` para impedir o commit acidental do arquivo de banco SQLite local.
- **FR-013**: A suíte de testes unitários e de integração DEVE cobrir o ciclo completo de persistência (DDL, seed, CRUD de incidentes, filtros, restrições CHECK e execução de tools) utilizando instâncias em memória (`:memory:`).

---

### Key Entities *(include if feature involves data)*

- **Service**: Representa um microserviço ou componente do sistema monitorado.
  - Atributos: `id` (chave única), `name` (identificador textual único), `description` (finalidade), `tier` (`tier-1`, `tier-2`, `tier-3`).
- **Alert**: Representa um evento de alerta gerado pelo sistema de observabilidade.
  - Atributos: `id` (chave única), `service` (serviço associado), `title` (resumo do alerta), `severity` (`low`, `medium`, `high`, `critical`), `status` (`firing`, `resolved`), `timestamp` (data/hora em ISO 8601).
- **Incident**: Representa uma ocorrência operacional formalmente aberta para mitigação.
  - Atributos: `id` (chave única), `title` (título operacional), `service` (serviço impactado), `severity` (`low` a `critical`), `status` (`open`, `resolved`), `createdAt`, `updatedAt`, `resolvedAt` (opcional), `summary` (opcional, detalhamento do fechamento).
- **Runbook**: Representa o procedimento padronizado de diagnóstico e resolução de falhas associado a um serviço.
  - Atributos: `id` (chave única), `service` (nome do serviço), `title` (título do procedimento), `content` (passos de diagnóstico e remediação em markdown), `createdAt`, `updatedAt`.
- **OpsStore**: Interface abstrata de acesso e mutação do estado operacional, implementada por `SqliteOpsStore` e `InMemoryStore`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O estado operacional completo (serviços, alertas e incidentes) persiste de maneira íntegra e sem corrupção após o encerramento e reinício do processo da aplicação.
- **SC-002**: 100% das tentativas de inserir dados que violem os domínios permitidos (`tier`, `severity` ou `status`) são rejeitadas com erro de integridade.
- **SC-003**: A rotina de semente de dados (`seed`) pode ser executada repetidamente sem duplicação de dados e conclui em menos de 100 milissegundos.
- **SC-004**: 100% das ferramentas do agente possuem descrição clara de quando usar, quando não usar e anotações descritivas em todos os parâmetros.
- **SC-005**: 100% dos testes automatizados de persistência e das ferramentas executam com isolamento total em memória (`:memory:`) em menos de 2 segundos na suíte de testes.

---

## Assumptions

- O runtime utilizado é o Node.js 22 LTS, que disponibiliza o módulo nativo `node:sqlite` com suporte síncrono (`DatabaseSync`).
- O banco de dados padrão para desenvolvimento e produção é local em arquivo (`./data/opspilot.db`), não exigindo serviços externos ou servidores de banco dedicados.
- A persistência em memória (`:memory:`) é estritamente equivalente em comportamento SQL e compatível com a persistência em arquivo.
- Os runbooks contêm instruções em formato de texto estruturado/markdown para consumo direto tanto por operadores humanos quanto pelo modelo de linguagem da APO.
- A implementação `InMemoryStore` é mantida para possibilitar a execução de benchmarks isolados e repetíveis com estado imutável de baseline.
