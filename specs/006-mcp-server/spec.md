# Feature Specification: Servidor MCP do OpsPilot (`006-mcp-server`)

**Feature Branch**: `006-mcp-server`  
**Created**: 2026-09-21  
**Status**: Draft  
**Input**: User description: "MCP server do OpsPilot: src/mcp/server.ts com @modelcontextprotocol/sdk, transport stdio, expondo list_alerts, open_incident e resolve_incident - reutilizando o mesmo OpsStore e os mesmos schemas zod das tools existentes (uma única fonte de verdade). Nome do server: opspilot. Script npm: mcp = 'tsx --env-file=.env src/mcp/server.ts'. REGRA CRÍTICA: nenhum console.log no server - no stdio o stdout é o canal do protocolo; diagnóstico vai para o stderr. Test: sobe o server e valida o list de tools"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descoberta e Listagem de Ferramentas Operacionais via MCP (Priority: P1) 🎯 MVP

Como um cliente ou assistente de IA externo compatível com o protocolo aberto de contexto (MCP), desejo me conectar ao servidor OpsPilot através da entrada e saída padrão (stdio) e listar as ferramentas disponíveis, para que eu possa reconhecer e invocar autonomamente as capacidades operacionais do sistema.

**Why this priority**: É o ponto de entrada e o contrato básico de interoperabilidade do MCP. Sem o catálogo funcional de ferramentas (`tools/list`), nenhum cliente MCP pode interagir com o OpsPilot.

**Independent Test**: Iniciar o processo do servidor via transporte stdio com um cliente de teste mock/in-memory, enviar a requisição de inicialização/listagem de ferramentas e verificar que o servidor responde com sucesso listando `list_alerts`, `open_incident` e `resolve_incident`, acompanhadas de suas descrições e esquemas de parâmetros.

**Acceptance Scenarios**:

1. **Given** o servidor OpsPilot iniciado sobre o transporte padrão stdio,  
   **When** o cliente MCP envia uma requisição `tools/list`,  
   **Then** o servidor responde com o catálogo contendo as ferramentas `list_alerts`, `open_incident` e `resolve_incident` com seus respectivos metadados semânticos e esquemas Zod refletidos em JSON Schema.

2. **Given** a inicialização da conexão entre o cliente e o servidor OpsPilot,  
   **When** o handshake de protocolo ocorre,  
   **Then** o servidor se identifica com o nome oficial `opspilot` e versão compatível.

---

### User Story 2 - Execução de Operações de Plantão com Fonte Única de Verdade (Priority: P2)

Como um operador de plantão interagindo via cliente MCP (ex.: Claude Desktop, Cursor, ou outro agente), desejo solicitar a consulta de alertas e a abertura/resolução de incidentes, para que o estado operacional de produção seja modificado e persistido de forma consistente no mesmo repositório de dados (`OpsStore`) que o restante do ecossistema OpsPilot utiliza.

**Why this priority**: Garante integridade de dados e conformidade funcional, reutilizando a mesma loja operacional e os mesmos schemas Zod para evitar duplicação ou divergência de regras de negócio.

**Independent Test**: Executar requisições MCP `tools/call` para `list_alerts`, `open_incident` e `resolve_incident`, confirmando que as ações refletem diretamente no `OpsStore` compartilhado e retornam payloads textuais ou JSON estruturados.

**Acceptance Scenarios**:

1. **Given** alertas populados no `OpsStore`,  
   **When** o cliente invoca `list_alerts` com filtro de status (ou padrão `firing`),  
   **Then** o servidor retorna a lista de alertas correspondentes sem corromper a sessão do protocolo.

2. **Given** a necessidade de registrar uma instabilidade operacional,  
   **When** o cliente invoca `open_incident` com título, serviço e severidade válidos,  
   **Then** um novo incidente com identificador único é criado no `OpsStore` e seus dados são retornados como resposta da ferramenta.

3. **Given** um incidente em aberto no `OpsStore`,  
   **When** o cliente invoca `resolve_incident` com o identificador do incidente e resumo da mitigação,  
   **Then** o status do incidente é atualizado para `resolved` com registro do resumo e retornado com confirmação.

---

### User Story 3 - Integridade de Protocolo stdio e Isolamento de Diagnóstico em stderr (Priority: P3)

Como mantenedor e operador de infraestrutura, exijo que nenhuma mensagem de log ou impressão indevida seja enviada para `stdout`, direcionando todos os diagnósticos exclusivamente para `stderr`, para que a comunicação JSON-RPC do protocolo MCP jamais seja corrompida por saídas textuais espúrias.

**Why this priority**: No transporte stdio, `stdout` é o canal estrito de transporte de mensagens do protocolo. Qualquer `console.log` acidental quebra o parser JSON-RPC do cliente e derruba a sessão do agente.

**Independent Test**: Inspecionar e monitorar a saída padrão (`stdout`) e a saída de erro (`stderr`) durante o ciclo de vida do servidor; simular registros de depuração/erros e verificar que `stdout` contém exclusivamente frames JSON-RPC válidos, enquanto mensagens de log e diagnósticos fluem para `stderr`.

**Acceptance Scenarios**:

1. **Given** o servidor MCP em execução contínua atendendo requisições,  
   **When** ocorrem mensagens informativas, avisos ou rastros de erro interno,  
   **Then** essas mensagens são direcionadas estritamente para `stderr` ou logger especializado, mantendo o `stdout` 100% puro para frames do protocolo.

2. **Given** um payload com argumentos inválidos enviado pelo cliente para uma ferramenta,  
   **When** o schema Zod rejeita a entrada,  
   **Then** o erro é empacotado como resposta de erro do protocolo MCP ou conteúdo de erro da tool sem emitir lixo não serializado para `stdout`.

---

### User Story 4 - Inicialização Conveniente via Script NPM (Priority: P4)

Como desenvolvedor ou integrador de ferramentas, desejo iniciar o servidor MCP através de um script padronizado (`npm run mcp`) com injeção automática das variáveis de ambiente de produção e banco de dados, para facilitar a configuração em clientes externos e ambientes de homologação.

**Why this priority**: Padroniza a inicialização do executável MCP de acordo com a convenção do projeto OpsPilot (utilizando suporte nativo `--env-file=.env`).

**Independent Test**: Executar `npm run mcp` (ou comando equivalente em teste automatizado) e confirmar que o processo sobe ouvindo em stdio com acesso às variáveis de ambiente configuradas.

**Acceptance Scenarios**:

1. **Given** o arquivo `package.json` do projeto,  
   **When** o comando `npm run mcp` é disparado,  
   **Then** o script executa o servidor apontando para `src/mcp/server.ts` com `--env-file=.env` pré-carregado.

---

### Edge Cases

- **Argumentos Inválidos na Invocação de Ferramentas**: Se o cliente MCP enviar parâmetros fora do schema Zod (ex.: severidade inexistente, campos obrigatórios ausentes), o servidor deve retornar uma resposta amigável contendo as issues de validação sem derrubar o processo.
- **Resolução de Incidente Inexistente**: Quando `resolve_incident` for chamado com um ID que não existe no `OpsStore`, o servidor deve retornar mensagem de erro legível como resultado da tool, preservando a conexão stdio ativa.
- **Fechamento do Canal de Entrada (EOF/SIGINT)**: Quando o processo cliente fechar a stream de `stdin` ou enviar sinal de término, o servidor deve encerrar graciosamente, liberando conexões do banco de dados SQLite.
- **Escrita Concorrente ou Múltiplas Chamadas**: Múltiplas invocações consecutivas de `call_tool` não devem causar race conditions no `OpsStore`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer um servidor MCP denominado `opspilot` implementado com `@modelcontextprotocol/sdk`.
- **FR-002**: O servidor DEVE utilizar o transporte de entrada e saída padrão (`StdioServerTransport`).
- **FR-003**: O servidor DEVE expor via `tools/list` exatamente as três ferramentas operacionais essenciais: `list_alerts`, `open_incident` e `resolve_incident`.
- **FR-004**: O servidor DEVE reutilizar os mesmos esquemas Zod de entrada já definidos para as ferramentas do agente OpsPilot (`src/schemas/`), garantindo uma única fonte de verdade para regras e tipos.
- **FR-005**: O servidor DEVE delegar a execução das ferramentas para a instância ativa de `OpsStore` (`src/agents/ops-store.ts`), compartilhando a persistência com o restante do sistema.
- **FR-006**: O servidor NÃO DEVE emitir nenhuma mensagem arbitrária em `stdout` (proibido o uso de `console.log` na camada do servidor MCP); qualquer diagnóstico ou log DEVE ser emitido exclusivamente em `stderr` (`console.error` ou equivalente).
- **FR-007**: O arquivo `package.json` DEVE disponibilizar o script `mcp` mapeado para a execução TypeScript carregando o arquivo de ambiente (ex.: `tsx --env-file=.env src/mcp/server.ts`).
- **FR-008**: O projeto DEVE conter testes automatizados utilizando `node:test` que iniciam o servidor e validam a listagem correta e as chamadas das ferramentas sem necessidade de serviços externos.

### Key Entities

- **MCP Server (`opspilot`)**: Instância do servidor de protocolo de contexto que orquestra conexões, descoberta de capacidades e despacho de chamadas de ferramentas.
- **MCP Tool Definition**: Estrutura descritiva de cada ferramenta exposta, contendo nome semântico, descrição de uso e schema JSON Schema derivado dos schemas Zod canônicos do sistema.
- **OpsStore**: Repositório de dados operacional compartilhado (SQLite ou memória para testes) responsável pela gestão de serviços, alertas e ciclo de vida de incidentes.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das ferramentas solicitadas (`list_alerts`, `open_incident`, `resolve_incident`) são listadas e executáveis com sucesso via protocolo MCP.
- **SC-002**: Zero corrupção de mensagens do protocolo stdio durante o ciclo de vida do servidor (0% de bytes não pertencentes a frames JSON-RPC em `stdout`).
- **SC-003**: Tempo de inicialização e resposta do catálogo de ferramentas (`tools/list`) inferior a 250 milissegundos em execuções de teste local.
- **SC-004**: Cobertura de testes automatizados unitários/integração para o servidor MCP operando 100% offline, passando com código de saída 0 no comando `npm test`.

---

## Assumptions

- O SDK oficial `@modelcontextprotocol/sdk` será adicionado como dependência do projeto.
- O servidor MCP operará como um processo filho iniciado sob demanda por clientes MCP (como Claude Desktop, IDEs ou scripts de teste) através de pipes stdio.
- As ferramentas `list_alerts`, `open_incident` e `resolve_incident` reutilizam diretamente as definições semânticas e o contrato de dados previamente validados nas especificações do OpsPilot.
- Variáveis de ambiente como `OPSPILOT_DB` são respeitadas pelo servidor para apontar para o banco SQLite configurado.
