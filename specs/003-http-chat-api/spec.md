# Feature Specification: API HTTP para Interação de Chat Operacional (`POST /chat`)

**Feature Branch**: `003-http-chat-api`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "POST /chat em src/http/server.ts (ou padrão do express) :body { message, strategy?, reflect } validado com zod; default react 200 { answer, trace, metrics }; 400 body inválido (issues do zod); 422 estratégia desconhecida; timeout 180s -> 504. Registry em src/agents/index.ts (nome> estratégia; reflect aplica withReflection) Teste de integração com estrategia fake deterministica, sem rede"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulta Operacional Padrão via Chat HTTP (Priority: P1) 🎯 MVP

Como operador de infraestrutura ou sistema integrado, quero enviar uma mensagem em linguagem natural para o endpoint `POST /chat` sem especificar configurações avançadas, para obter a resposta da APO executada pela estratégia padrão (`react`), acompanhada do trace completo de raciocínio e das métricas operacionais.

**Why this priority**: Estabelece o canal de entrada HTTP primário para comunicação síncrona com o agente, permitindo a integração de interfaces web, bots de Slack/Discord ou ferramentas de automação.

**Independent Test**: Enviar uma requisição HTTP `POST /chat` com payload `{"message": "Verifique os alertas"}` contra uma estratégia determinística mockada; validar retorno HTTP `200 OK` contendo `{ answer, trace, metrics }`.

**Acceptance Scenarios**:

1. **Given** o servidor HTTP em execução e uma estratégia padrão registrada, **When** um cliente envia `POST /chat` com `{"message": "Qual o status dos alertas?"}`, **Then** a API retorna status `200 OK` com JSON contendo `answer` (texto), `trace` (lista ordenada de eventos) e `metrics` (`llmCalls` e `latencyMs`).
2. **Given** um payload válido sem o campo `strategy`, **When** a requisição for processada, **Then** o sistema seleciona automaticamente a estratégia padrão `react`.
3. **Given** um payload válido sem o campo `reflect`, **When** a requisição for processada, **Then** a reflexão é desativada por padrão (`reflect: false`).

---

### User Story 2 - Seleção de Estratégia de Raciocínio e Ativação de Reflection (Priority: P2)

Como operador sênior ou engenheiro de confiabilidade, quero especificar explicitamente qual estratégia cognitiva desejo utilizar (ex.: `plan-and-execute`) e se desejo ativar a camada de auto-avaliação e reflexão (`reflect: true`), para ajustar a profundidade do raciocínio à complexidade do incidente.

**Why this priority**: Desbloqueia o suporte a múltiplos modos cognitivos e auto-correção reflexiva via API REST conforme a necessidade do caso de uso.

**Independent Test**: Enviar `POST /chat` com `{"message": "resolva o problema", "strategy": "plan-and-execute", "reflect": true}` e validar que a estratégia invocada é decorada com reflexão, produzindo eventos do tipo `critique` no trace consolidado.

**Acceptance Scenarios**:

1. **Given** uma estratégia registrada no sistema, **When** o cliente envia `strategy: "plan-and-execute"` no body, **Then** a execução é roteada para a estratégia correspondente.
2. **Given** um pedido com `reflect: true`, **When** a requisição é executada, **Then** o sistema aplica o decorator de reflexão sobre a estratégia escolhida, adicionando a crítica estruturada e acumulando métricas e eventos de avaliação.

---

### User Story 3 - Resiliência, Validação Estrita na Fronteira e Controle de Timeout (Priority: P3)

Como mantenedor do sistema, quero que qualquer requisição mal formatada, estratégia inexistente ou execução que exceda o teto de tempo seja rejeitada com códigos de status HTTP e mensagens padronizadas, para garantir a estabilidade e a previsibilidade da API.

**Why this priority**: Garante a governança e proteção do servidor contra travamentos, requisições malformadas e esgotamento de recursos.

**Independent Test**: 
- Enviar requisições com corpo malformatado e validar status `400 Bad Request` com lista detalhada de issues.
- Enviar estratégia inexistente e validar status `422 Unprocessable Entity`.
- Simular processamento que excede o timeout de 180s e validar resposta `504 Gateway Timeout`.

**Acceptance Scenarios**:

1. **Given** um payload com corpo vazio ou tipo inválido em `message`, **When** a validação ocorrer, **Then** a API retorna status `400 Bad Request` com o detalhamento das violações do schema.
2. **Given** um payload solicitando uma estratégia não cadastrada (ex.: `strategy: "inexistente"`), **When** a API tentar localizar o executor, **Then** retorna status `422 Unprocessable Entity` indicando estratégia desconhecida e listando as opções suportadas.
3. **Given** uma execução do agente que ultrapasse 180 segundos (ou o tempo limite configurado), **When** o temporizador expirar, **Then** a API aborta a conexão pendente e retorna status `504 Gateway Timeout` com mensagem amigável.

---

### Edge Cases

- **Mensagem com espaços em branco**: Se `message` contiver apenas espaços, a validação de schema deve rejeitar com `400 Bad Request`.
- **Estratégia com capitalização diferente**: Nomes de estratégias como `"ReAct"` ou `"React"` devem ser normalizados para minúsculas antes da consulta ao catálogo.
- **Cancelamento antecipado pelo cliente**: Se o cliente fechar o socket HTTP antes da conclusão, o servidor deve interromper processamentos desnecessários sem gerar vazamento de memória ou erros não tratados.
- **Falha interna no motor de raciocínio**: Se a estratégia selecionada disparar uma exceção de runtime não tratada, a API deve responder com status `500 Internal Server Error` estruturado sem expor stack trace sensível.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor uma rota HTTP no método `POST /chat` capaz de receber comandos operacionais em formato JSON.
- **FR-002**: O sistema DEVE validar o corpo da requisição contra um schema estrito contendo:
  - `message`: string obrigatória não vazia (mínimo 1 caractere visível).
  - `strategy`: string opcional, com valor padrão `"react"`.
  - `reflect`: booleano opcional, com valor padrão `false`.
- **FR-003**: Se o corpo da requisição for inválido, o sistema DEVE retornar status HTTP `400 Bad Request` acompanhado de um payload JSON contendo os erros específicos de validação identificados.
- **FR-004**: O sistema DEVE manter um catálogo centralizado de estratégias disponíveis, capaz de resolver o executor correspondente pelo nome.
- **FR-005**: Se a estratégia solicitada não existir no catálogo, o sistema DEVE retornar status HTTP `422 Unprocessable Entity` com mensagem clara e a relação de estratégias válidas.
- **FR-006**: Quando o campo `reflect` for verdadeiro (`true`), o sistema DEVE envolver dinamicamente a estratégia solicitada com a camada de reflexão cognitiva antes de executar.
- **FR-007**: Em caso de sucesso na execução, o sistema DEVE responder com status HTTP `200 OK` contendo exatamente:
  - `answer`: texto final da resposta da IA.
  - `trace`: array cronológico com os eventos estruturados emitidos durante a execução.
  - `metrics`: objeto consolidado com a contagem de chamadas e latência total.
- **FR-008**: O sistema DEVE aplicar um teto máximo de tempo de resposta de 180 segundos por requisição; se o tempo for excedido, DEVE retornar status HTTP `504 Gateway Timeout`.
- **FR-009**: A suíte de testes de integração DEVE validar todos os fluxos HTTP (200, 400, 422, 504 e reflect) usando executores simulados determinísticos, operando 100% offline e sem necessidade de conexão externa ou chaves de API.

---

### Key Entities *(include if feature involves data)*

- **ChatRequest**: Representa o contrato de entrada submetido pelo cliente.
  - Atributos: `message` (texto do prompt do operador), `strategy` (identificador da estratégia desejada), `reflect` (indicador de auto-avaliação reflexiva).
- **ChatResponse**: Representa a entrega conclusiva de uma execução bem-sucedida.
  - Atributos: `answer` (resposta sintética), `trace` (registro auditável passo a passo), `metrics` (indicadores de esforço e tempo).
- **ErrorResponse**: Representa falhas estruturadas na fronteira HTTP.
  - Atributos: `error` (identificador ou resumo do erro), `message` (explicação compreensível), `details` (opcional, lista de inconsistências de validação ou estratégias aceitas).
- **StrategyRegistry**: Catálogo e fábrica em memória que armazena as estratégias disponíveis e gerencia a aplicação da reflexão sob demanda.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das requisições com dados mal formatados são interceptadas e respondidas em menos de 50ms com código HTTP `400`.
- **SC-002**: A suíte completa de testes de integração HTTP executa de forma determinística em menos de 3 segundos no ambiente de integração contínua sem depender de serviços externos.
- **SC-003**: 100% das respostas de sucesso (`200 OK`) contêm o trace completo dos passos executados para garantir a conformidade de auditoria operacional exigida pela constituição.
- **SC-004**: O tempo limite de segurança de 180s encerra confiavelmente requisições travadas sem deixar conexões ou processos zumbis no servidor.

---

## Assumptions

- O servidor HTTP utiliza a stack padrão do projeto (Express v5 configurado em modo estrito TypeScript ESM).
- O catálogo de estratégias padrão inicial suporta pelo menos as estratégias já existentes no projeto (`react` e `plan-and-execute`), além de suportar injeção de estratégias de teste/mock em ambientes automatizados.
- A porta e configurações de rede são definidas por variáveis de ambiente padrão com fallback seguro (ex.: porta 3000).
- O timeout padrão de 180s é suficiente para operações com modelos cognitivos encadeados e pode ser ajustado para testes de integração rápidos.
