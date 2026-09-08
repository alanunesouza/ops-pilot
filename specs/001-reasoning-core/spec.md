# Feature Specification: Núcleo de Raciocínio do OpsPilot

**Feature Branch**: `001-reasoning-core`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "Núcleo de raciocínio do OpsPilot:
- interface comum reasoningStrategy: name + run(input) -> (answer, trace, metrics); trace = eventos tipados (thought | action | observation | plan | critique | answer; action carrega (tool, args)); metrics = (llmCalls, latencyMs)
- Fábrica única em src/agents/model.ts lendo OPENROUTER_API_KEY e OPENROUTER_MODEL (baseURL do OpenRouter), temperature 0.
- Ferramentas mock em src/agents/tools.ts sobre um store in-memory pré populado (o seed primário: 5 serviços, 6 alertas variados - 3 firing, 3 resolved (crie um script para rodar o seed, e execute ele ao final desse prompt)): list_alerts(status), open_incident(title, service, severity), resolve_incident(id). Schemas zod, banco mysql, utilizando sequelize.
- Estratégia ReAct em src/agents/react.ts usando o agente ReAct pré construído do LangGraph com essas tools, capturando o trace completo.
- Estratégia Plan-and-Execute em src/agents/plan-and-execute.ts como grafo: planner (saída estruturada: lista de passos), executor (um passo por vez com as tools), replanner (revisa o restante após cada passo; encerra quando não resta nada). Máximo 8 passos.
- Toda estratégia respeita limite de iterações e conta chamadas de LLM. Arena mínima em src/arena.ts: roda 1+ estratégias sobre o mesmo input e imprime traces e métricas (flags --strategies e --max-iterations).
- Testes: store e formatação de trace (determinísticos, sem rede)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Raciocínio Operacional com ReAct e Rastreabilidade Completa (Priority: P1)

Como operador de plantão (on-call), desejo enviar uma consulta ou alerta para a APO e receber tanto a resposta resolutiva quanto a trilha cronológica detalhada de raciocínio (`thought`, `action`, `observation`, `answer`) com métricas de execução, para auditar com precisão cada decisão tomada durante um incidente.

**Why this priority**: É a espinha dorsal da observabilidade do agente OpsPilot. Sem contrato comum de estratégia e captura confiável de traces, não é possível auditar ações operacionais nem garantir segurança em produção.

**Independent Test**: Pode ser testado de forma isolada instanciando a estratégia ReAct com o store de alertas/incidentes mockado, enviando um comando como "Verifique os alertas ativos e abra um incidente crítico se necessário", verificando que a resposta final é acompanhada por eventos de trace tipados e métricas de latência e contagem de chamadas de LLM.

**Acceptance Scenarios**:

1. **Given** o sistema configurado com a estratégia ReAct e o store inicializado, **When** o usuário solicita a análise de alertas ativos, **Then** o sistema executa o loop ReAct, emite eventos de `thought`, `action` (com ferramenta e argumentos), `observation` (com saída da ferramenta) e `answer` final estruturada.
2. **Given** a execução da estratégia finalizada, **When** o operador inspeciona as métricas retornadas, **Then** o sistema apresenta a contagem exata de chamadas de LLM efetuadas e a latência total decorrida em milissegundos.

---

### User Story 2 - Planejamento e Execução Adaptativa (Plan-and-Execute) (Priority: P2)

Como engenheiro de operações, desejo que a APO consiga planejar antecipadamente um fluxo de mitigação de incidente decomposto em etapas sequenciais (`plan`), executá-las com ferramentas operacionais e reavaliar/revisar os passos restantes (`replanner`) até a resolução completa, respeitando o limite máximo de 8 passos.

**Why this priority**: Problemas operacionais complexos exigem visão holística e replanejamento sob novas observações, evitando loops cegos ou decisões desordenadas em incidentes multifacetados.

**Independent Test**: Pode ser testado executando a estratégia Plan-and-Execute sobre um cenário com múltiplos alertas, assegurando que o `planner` cria a lista estruturada de passos, o `executor` aciona as ferramentas corretas e o `replanner` reduz ou encerra o plano quando o objetivo é atingido em menos de 8 passos.

**Acceptance Scenarios**:

1. **Given** uma solicitação de incidente complexa, **When** a estratégia Plan-and-Execute é iniciada, **Then** o planejador gera uma lista inicial de passos (`plan`) e o executor processa o primeiro passo emitindo eventos correspondentes.
2. **Given** o término de cada passo de execução, **When** novas observações são geradas, **Then** o replanejador atualiza a lista de passos restantes ou sinaliza a conclusão definitiva do fluxo.
3. **Given** uma sequência que demanda muitas iterações, **When** a execução atinge o teto estrito de 8 passos, **Then** o grafo interrompe o fluxo de forma segura e sintetiza a melhor resposta possível sem entrar em loop infinito.

---

### User Story 3 - Arena de Avaliação e Benchmark de Estratégias (Priority: P3)

Como mantenedor do OpsPilot, desejo uma CLI de Arena (`src/arena.ts`) que permita executar um mesmo comando ou alerta sob diferentes estratégias de raciocínio (ex.: ReAct vs Plan-and-Execute), configurando flags como `--strategies` e `--max-iterations`, exibindo lado a lado o trace formatado e o comparativo de métricas.

**Why this priority**: Permite comparar o custo (chamadas de LLM), a latência e a qualidade analítica entre abordagens de raciocínio, embasando decisões de engenharia sobre qual estratégia empregar em cada classe de alerta.

**Independent Test**: Pode ser testado executando `npm run arena` passando `--strategies react,plan-and-execute --max-iterations 5`, validando se ambas as estratégias são instanciadas, executadas sobre a mesma entrada e suas saídas impressas de forma legível no terminal.

**Acceptance Scenarios**:

1. **Given** o comando `npm run arena -- --strategies react,plan-and-execute`, **When** uma entrada padrão de incidente é fornecida, **Then** a Arena executa sequencialmente as estratégias e exibe traces legíveis e tabela de métricas (LLM calls e latência).
2. **Given** a flag `--max-iterations 3`, **When** qualquer estratégia ultrapassar o número estipulado, **Then** a execução é interrompida no limite configurado respeitando o teto de iterações.

---

### User Story 4 - Repositório de Estado Operacional e Ferramentas Seguras (Priority: P4)

Como agente inteligente de operações, necessito de um conjunto de ferramentas padronizadas (`list_alerts`, `open_incident`, `resolve_incident`) operando sobre um estado controlado com dados de semente (5 serviços e 6 alertas: 3 ativos/firing e 3 resolvidos), para que eu possa inspecionar e alterar o ciclo de vida dos incidentes com validação estrita via esquemas de dados.

**Why this priority**: Garante que o agente possua ferramentas determinísticas, com entradas e saídas validadas, evitando mutações inválidas ou falhas de schema durante o plantão.

**Independent Test**: Pode ser testado executando diretamente as ferramentas via testes unitários, validando a filtragem de alertas por status, a abertura de incidentes com severidades válidas e a resolução por identificador, conferindo o estado resultante sem chamadas externas.

**Acceptance Scenarios**:

1. **Given** o store alimentado com o seed inicial, **When** o agente invoca `list_alerts` filtrando por status `firing`, **Then** exatamente 3 alertas ativos são retornados com seus respectivos serviços e metadados.
2. **Given** a ferramenta `open_incident`, **When** invocada com título, serviço válido e severidade, **Then** um novo incidente é registrado com identificador único e status inicial aberto.
3. **Given** um incidente aberto, **When** a ferramenta `resolve_incident` é invocada com o identificador correspondente, **Then** o incidente tem seu status atualizado para resolvido.

---

### Edge Cases

- **Esgotamento de Iterações**: Quando a estratégia atinge o `--max-iterations` sem atingir uma resposta final conclusiva, o sistema deve encerrar de forma graciosa, retornando a última síntese obtida, marcando no trace o encerramento forçado por limite.
- **Falha ou Resposta Incorreta de Ferramenta**: Se a LLM passar argumentos inválidos para uma ferramenta (ex.: severidade inexistente ou ID inválido), a validação deve retornar o erro como `observation` para que o agente possa criticar e corrigir o raciocínio.
- **Latência ou Erro do Provedor de Modelo**: Na ausência de credenciais ou indisponibilidade da API, a camada de modelo deve lançar erro de domínio explícito em vez de travar o processo.
- **Plano Vazio no Replanner**: Caso o `planner` ou `replanner` decida que nenhuma ação adicional é requerida logo na primeira iteração, o sistema deve emitir diretamente o evento de `answer` sem invocar ferramentas desnecessariamente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE definir uma interface unificada `ReasoningStrategy` contendo `name: string` e método assíncrono `run(input: string, options?: StrategyOptions): Promise<StrategyResult>`, retornando `answer: string`, `trace: TraceEvent[]` e `metrics: ExecutionMetrics`.
- **FR-002**: O sistema DEVE tipar estritamente os eventos de `trace` nas seguintes categorias: `thought`, `action`, `observation`, `plan`, `critique` e `answer`, onde eventos do tipo `action` obrigatoriamente carregam os campos `tool` (nome da ferramenta) e `args` (parâmetros fornecidos).
- **FR-003**: O sistema DEVE registrar nas métricas de execução (`ExecutionMetrics`) a quantidade total de chamadas à LLM (`llmCalls: number`) e a latência total decorrida (`latencyMs: number`).
- **FR-004**: O sistema DEVE disponibilizar uma fábrica única de modelo de linguagem em `src/agents/model.ts`, configurada com `temperature: 0` e lendo as configurações `OPENROUTER_API_KEY` e `OPENROUTER_MODEL` apontando para o endpoint base do OpenRouter.
- **FR-005**: O sistema DEVE disponibilizar um repositório in-memory e modelos relacionais Sequelize/MySQL para gerenciamento de alertas e incidentes com dados de semente primária (5 serviços distintos e 6 alertas: 3 com status `firing` e 3 com status `resolved`).
- **FR-006**: O sistema DEVE fornecer um script executável para inicializar/executar o seed primário de serviços e alertas no ambiente.
- **FR-007**: O sistema DEVE expor como ferramentas padronizadas do agente (`src/agents/tools.ts`) com validação via schemas `zod`:
  - `list_alerts`: recebe filtro opcional por `status` (`firing` ou `resolved`) e retorna a lista de alertas.
  - `open_incident`: recebe `title`, `service` e `severity` (`low`, `medium`, `high`, `critical`) e registra um novo incidente.
  - `resolve_incident`: recebe `id` do incidente e atualiza seu status para resolvido.
- **FR-008**: O sistema DEVE implementar em `src/agents/react.ts` a estratégia ReAct utilizando o grafo/agente ReAct do LangGraph com as ferramentas operacionais, interceptando e capturando a sequência completa de traces e métricas.
- **FR-009**: O sistema DEVE implementar em `src/agents/plan-and-execute.ts` a estratégia Plan-and-Execute estruturada em grafo LangGraph composto por nós de:
  - `planner`: gera a decomposição estruturada de passos.
  - `executor`: despacha a execução de um passo por vez interagindo com as ferramentas disponíveis.
  - `replanner`: reavalia os passos pendentes após cada observação e decide se deve continuar ou encerrar.
- **FR-010**: A estratégia Plan-and-Execute DEVE limitar estritamente a execução a um teto máximo de 8 passos por ciclo de resolução.
- **FR-011**: Todas as estratégias DEVEM respeitar o limite máximo de iterações configurável e computar de forma acumulada e fidedigna as chamadas de modelo realizadas.
- **FR-012**: O sistema DEVE disponibilizar a CLI de Arena em `src/arena.ts`, aceitando flags `--strategies` (estratégias a executar separadas por vírgula) e `--max-iterations` (limite de iterações por estratégia), imprimindo o trace formatado e sumário comparativo de métricas.
- **FR-013**: O sistema DEVE conter suíte de testes automatizados com `node:test` cobrindo o store in-memory, a execução das ferramentas e a formatação dos traces de forma estritamente determinística e sem dependência de rede externa.

### Key Entities

- **ReasoningStrategy**: Contrato unificado de agente com identificador e executor de resolução.
- **TraceEvent**: Evento temporal emitido pelo agente durante o raciocínio, contendo tipo (`thought`, `action`, `observation`, `plan`, `critique`, `answer`), conteúdo textual, metadados opcionais (`tool`, `args`) e timestamp.
- **ExecutionMetrics**: Registro quantitativo do consumo do agente, contendo contagem de chamadas de LLM (`llmCalls`) e tempo total de execução (`latencyMs`).
- **Service**: Representação do microsserviço ou componente monitorado (ex.: `auth-service`, `payment-gateway`, `order-api`).
- **Alert**: Registro de alerta operacional, contendo id, título, serviço associado, severidade, status (`firing` ou `resolved`) e timestamp.
- **Incident**: Registro de incidente em andamento ou resolvido, contendo id, título, serviço afetado, severidade (`low`, `medium`, `high`, `critical`), status (`open` ou `resolved`) e histórico de ações.
- **PlanStep**: Etapa individual planejada contendo descrição da ação a ser executada e status de conclusão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das execuções em qualquer estratégia geram trace estruturado contendo apenas eventos tipados válidos e métricas computadas (`llmCalls >= 1` e `latencyMs > 0`).
- **SC-002**: A estratégia Plan-and-Execute nunca ultrapassa 8 passos de execução, finalizando ou interrompendo com segurança mesmo em cenários de alta ambiguidade.
- **SC-003**: A CLI da Arena permite rodar múltiplas estratégias sobre a mesma entrada e exibir relatório comparativo legível com tempo de resposta e consumo de chamadas em menos de 1 segundo de overhead operacional além do tempo das LLMs.
- **SC-004**: 100% dos testes unitários de store, ferramentas e formatação de traces rodam de forma determinística em ambiente isolado (sem internet e sem credenciais reais) com tempo de execução inferior a 5 segundos.
- **SC-005**: 100% dos dados manipulados pelas ferramentas passam por validação estrita com Zod antes de persistir ou modificar qualquer registro.

## Assumptions

- O ambiente possui suporte nativo a Node.js 22 LTS com TypeScript em modo ESM estrito.
- As credenciais para chamadas reais de LLM são lidas de variáveis de ambiente (`OPENROUTER_API_KEY` e `OPENROUTER_MODEL`), enquanto testes unitários utilizam mocks determinísticos.
- A persistência primária para a arena e testes rápidos é in-memory, espelhando os modelos Sequelize definidos para o banco de dados MySQL da aplicação.
- A semente primária (seed) de 5 serviços e 6 alertas pode ser recarregada a qualquer momento através do script dedicado para restaurar o estado inicial de testes.
