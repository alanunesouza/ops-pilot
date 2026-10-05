# Feature Specification: Conversa Persistente (`007-persistent-conversation`)

**Feature Branch**: `007-persistent-conversation`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Conversa persistente: - ConversationStore (append/lastMessages/create) + tabela messages como no SqliteOpsStore - /chat: conversationId opcional, devolvido na resposta - 12 últimas mensagens no prompt via composição; métrica historyMessages - testes \":memory:\" + fake"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistência Relacional de Histórico com ConversationStore (Priority: P1) 🎯 MVP

Como operador do plantão ou sistema de chamados, quero que todas as mensagens trocadas com o OpsPilot sejam registradas de forma persistente e transacional por conversa, para que o contexto operacional não seja perdido ao longo de turnos ou reinicializações do servidor.

**Why this priority**: Estabelece o alicerce fundamental de armazenamento relacional para sessões e mensagens, viabilizando memória de diálogo confiável e auditabilidade.

**Independent Test**: Instanciar o `ConversationStore` sobre SQLite (em memória ou arquivo), criar uma conversa, anexar mensagens consecutivas com diferentes papéis (`user`, `assistant`), recuperar as últimas mensagens e validar a integridade da ordem e conteúdo.

**Acceptance Scenarios**:

1. **Given** um `ConversationStore` inicializado, **When** o método `create()` é invocado, **Then** uma nova conversa é gerada com identificador único (`conversationId`) e disponibilizada para persistência.
2. **Given** uma conversa existente, **When** o método `append(conversationId, role, content)` é executado, **Then** o registro da mensagem é salvo na tabela `messages` com ID único, papel validado, conteúdo e timestamp.
3. **Given** uma conversa contendo histórico de mensagens, **When** o método `lastMessages(conversationId, limit)` é chamado com limite `N`, **Then** são retornadas até `N` mensagens mais recentes da conversa em ordem cronológica correta para reconstrução do diálogo.

---

### User Story 2 - Rastreamento e Devolução de Sessão no Endpoint HTTP /chat (Priority: P2)

Como cliente da API HTTP (interface web, CLI ou webhook de incidentes), quero enviar opcionalmente um `conversationId` na requisição `POST /chat` e receber na resposta o identificador da conversa ativa, para conseguir manter um diálogo interativo contínuo através de múltiplas chamadas HTTP.

**Why this priority**: Habilita a continuidade da conversa na fronteira de entrada da aplicação sem quebrar clientes que não informem ID (gerando uma nova conversa automaticamente).

**Independent Test**: Fazer uma requisição `POST /chat` sem `conversationId` e verificar que a resposta traz um novo identificador; em seguida, realizar uma segunda requisição informando o mesmo identificador e confirmar que ambas as mensagens pertencem à mesma sessão de conversa no store.

**Acceptance Scenarios**:

1. **Given** uma requisição `POST /chat` válida sem `conversationId` no corpo, **When** o endpoint processa a mensagem, **Then** cria uma nova conversa, executa o agente, persiste a mensagem do usuário e a resposta gerada, e retorna o novo `conversationId` no payload de resposta (200 OK).
2. **Given** uma requisição `POST /chat` válida contendo um `conversationId` existente, **When** o endpoint processa a requisição, **Then** anexa a nova mensagem à conversa existente, executa o agente contextualizado, persiste a resposta e devolve o mesmo `conversationId` na resposta.
3. **Given** uma requisição com corpo inválido (ex.: `conversationId` em formato inválido ou vazio quando enviado), **When** validado pelo schema Zod na borda, **Then** retorna status `400 Bad Request` com os detalhes do erro de validação.

---

### User Story 3 - Injeção de Histórico no Prompt via Composição e Métrica historyMessages (Priority: P3)

Como operador em conversa interativa, quero que as últimas 12 mensagens do histórico sejam injetadas no contexto do prompt do agente via composição limpa de estratégias, para que o modelo responda ciente do histórico recente e informe a métrica `historyMessages` no payload de execução.

**Why this priority**: Garante que o agente compreenda pronomes, referências anteriores e instruções incrementais no mesmo incidente, medindo de forma observável quantas mensagens históricas foram aproveitadas.

**Independent Test**: Alimentar uma conversa com mais de 12 mensagens, disparar uma nova pergunta e inspecionar o prompt gerado para o modelo, comprovando que apenas as 12 mensagens mais recentes foram compostas no prompt e que o objeto de métricas na resposta contém `historyMessages: 12`.

**Acceptance Scenarios**:

1. **Given** uma conversa recém-criada (sem histórico prévio), **When** a primeira mensagem é processada, **Then** o prompt não contém mensagens anteriores e a resposta traz a métrica `historyMessages: 0`.
2. **Given** uma conversa com 5 mensagens prévias, **When** uma nova mensagem do usuário é enviada, **Then** as 5 mensagens anteriores são compostas no contexto do prompt e a resposta reporta `historyMessages: 5`.
3. **Given** uma conversa com 20 mensagens acumuladas, **When** uma nova interação ocorre, **Then** uma janela deslizante contendo exatamente as 12 últimas mensagens é fornecida ao agente e a métrica reporta `historyMessages: 12`.

---

### User Story 4 - Isolamento em Testes com SQLite :memory: e Estratégia Fake (Priority: P4)

Como engenheiro de software mantendo a suíte de testes, quero testar toda a lógica de persistência e integração HTTP usando SQLite `:memory:` e estratégias simuladas (`FakeReasoningStrategy`), para garantir testes determinísticos, rápidos e sem efeitos colaterais de rede ou disco.

**Why this priority**: Preserva o padrão do repositório (TDD, execução rápida com `node:test`, sem acoplamento a chaves de API externas nos testes automatizados).

**Independent Test**: Executar a suíte de testes unitários e de integração (`npm test`), validando que todos os cenários de `ConversationStore` e `POST /chat` rodam sobre conexões `:memory:` em milissegundos sem chamadas externas ao LLM.

**Acceptance Scenarios**:

1. **Given** a suíte de testes do store, **When** executada com banco `:memory:`, **Then** valida criação de tabela DDL, inserções, consultas limitadas e restrições sem tocar no sistema de arquivos.
2. **Given** os testes de integração do servidor HTTP, **When** executados com `FakeReasoningStrategy` e `:memory:`, **Then** cobrem o fluxo completo de ida e volta do `conversationId`, persistência de mensagens e cálculo da métrica `historyMessages`.

---

### Edge Cases

- **Formato inválido de conversationId**: Se o cliente enviar um `conversationId` mal formatado ou fora do padrão esperado, o schema Zod deve rejeitar com `400 Bad Request`.
- **Janela deslizante de histórico superior a 12 mensagens**: Quando a conversa acumula dezenas de mensagens, apenas as 12 mais recentes devem ser incluídas no prompt, descartando as mais antigas da composição do prompt imediato, mas preservando-as integralmente no banco para auditoria.
- **Falha de persistência durante o processamento**: Se a gravação da mensagem ou da resposta falhar por erro de banco, a requisição deve ser tratada sem corromper a resposta ou deve retornar erro de servidor consistente (`500 Internal Server Error`).
- **Conversa sem mensagens prévias**: Se uma conversa existir mas não possuir mensagens (ou para a primeira mensagem de uma sessão nova), a métrica `historyMessages` deve ser `0` e o prompt deve ser montado sem cabeçalho de histórico corrompido.
- **Caracteres especiais e multilinhas**: Mensagens com quebras de linha, aspas, emojis ou caracteres especiais devem ser persistidas e recuperadas sem escape indevido ou corrupção de string.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE definir a interface TypeScript `ConversationStore` (em `src/store/types.ts` ou arquivo dedicado) contendo os métodos:
  - `create(): string` (cria ou aloca uma nova conversa e devolve seu identificador único).
  - `append(conversationId: string, role: "user" | "assistant" | "system", content: string): Message` (anexa mensagem à conversa).
  - `lastMessages(conversationId: string, limit?: number): Message[]` (retorna até `limit` mensagens da conversa, em ordem cronológica crescente, com default de 12).
- **FR-002**: O sistema DEVE fornecer implementação relacional do `ConversationStore` utilizando a API síncrona nativa `node:sqlite` (`DatabaseSync`), integrado ao `SqliteOpsStore` ou em classe dedicada compatível com o mesmo banco configurado via `OPSPILOT_DB`.
- **FR-003**: A tabela de mensagens (`messages`) DEVE possuir DDL idempotente (`CREATE TABLE IF NOT EXISTS`) contendo os campos:
  - `id TEXT PRIMARY KEY`
  - `conversation_id TEXT NOT NULL`
  - `role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system'))`
  - `content TEXT NOT NULL`
  - `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
  - Índice por `(conversation_id, created_at)` para consultas eficientes de histórico.
- **FR-004**: O schema de entrada `ChatRequestSchema` (em `src/schemas/chat.ts`) DEVE ser estendido para aceitar o campo opcional `conversationId: z.string().trim().min(1).optional()`.
- **FR-005**: O endpoint `POST /chat` DEVE gerar um novo `conversationId` via `create()` caso nenhum identificador tenha sido fornecido na requisição.
- **FR-006**: O schema de resposta `ChatResponseSchema` e a rota `POST /chat` DEVEM devolver o campo obrigatório `conversationId: string`.
- **FR-007**: O schema de métricas `ExecutionMetricsSchema` DEVE incluir o campo `historyMessages: z.number().int().nonnegative()`, indicando a quantidade de mensagens do histórico recuperadas e injetadas no prompt da interação.
- **FR-008**: O endpoint `POST /chat` DEVE persistir no `ConversationStore` a mensagem enviada pelo usuário antes da chamada à estratégia e a resposta final emitida pelo agente após a conclusão.
- **FR-009**: A injeção das últimas mensagens no prompt DEVE ocorrer via composição de estratégia ou wrapper de composição, limitando o histórico recuperado a no máximo 12 mensagens mais recentes.
- **FR-010**: A formatação do histórico no prompt DEVE preservar os papéis (`User` e `Assistant`) e o conteúdo de cada turno, orientando o modelo sobre o contexto da conversa em andamento.
- **FR-011**: A aplicação Express (`createApp`) DEVE aceitar a injeção opcional de uma instância de `ConversationStore`, permitindo que testes forneçam instâncias `:memory:`.
- **FR-012**: Todos os testes automatizados da funcionalidade DEVEM utilizar SQLite em memória (`:memory:`) e estratégias fake determinísticas, sem dependência de serviços externos ou arquivos residuais em disco.

---

### Key Entities *(include if feature involves data)*

- **Conversation**: Representa a sessão de diálogo persistente entre o usuário/sistema e o OpsPilot.
  - Atributos: `id` (identificador único da conversa), `createdAt` (data/hora de início da sessão).
- **Message**: Representa uma mensagem individual enviada por um ator no diálogo.
  - Atributos: `id` (identificador único da mensagem), `conversationId` (chave de associação com a conversa), `role` (`user`, `assistant`, `system`), `content` (texto da mensagem), `createdAt` (timestamp da mensagem).
- **ConversationStore**: Interface abstrata de operações de leitura e gravação do ciclo de vida das conversas e mensagens.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das requisições bem-sucedidas em `POST /chat` devolvem um `conversationId` válido e o número exato de mensagens de histórico recuperadas no campo `metrics.historyMessages`.
- **SC-002**: Clientes subsequentes que informem o mesmo `conversationId` têm o contexto prévio preservado em até 12 turnos anteriores de mensagem.
- **SC-003**: A recuperação de até 12 mensagens históricas em SQLite executa em menos de 10 milissegundos em testes locais.
- **SC-004**: 100% dos testes unitários e de integração de persistência conversacional executam com isolamento total sobre `:memory:` sem falhas.

---

## Assumptions

- O runtime utilizado permanece o Node.js 22 LTS com `DatabaseSync` nativo (`node:sqlite`).
- O banco de dados do `ConversationStore` compartilha o mesmo arquivo ou conexão configurada em `OPSPILOT_DB` (`./data/opspilot.db`), ou instância `:memory:` equivalente.
- A composição de histórico limita-se às 12 mensagens mais recentes para não ultrapassar limites de janela de contexto do LLM.
- O formato de identificadores de conversa é uma string única e não vazia (por exemplo, UUID v4 gerado via `crypto.randomUUID()`).
- O suporte a `conversationId` opcional mantém compatibilidade retroativa com clientes HTTP existentes.
