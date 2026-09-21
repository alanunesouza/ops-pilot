# Research: Servidor MCP do OpsPilot (`006-mcp-server`)

**Feature**: Servidor MCP (`src/mcp/server.ts`) sobre stdio, expondo `list_alerts`, `open_incident` e `resolve_incident`.  
**Date**: 2026-09-21  
**Status**: Completed  

---

## 1. Arquitetura do Protocolo MCP (@modelcontextprotocol/sdk)

### Decisão: Utilização de `McpServer` e `StdioServerTransport`
- **Decisão**: Utilizar a classe de alto nível `McpServer` do SDK oficial `@modelcontextprotocol/sdk/server/mcp.js` em conjunto com `StdioServerTransport` de `@modelcontextprotocol/sdk/server/stdio.js`.
- **Justificativa**:
  - `McpServer` fornece uma API fluente e tipada `server.tool(...)` que aceita schemas Zod nativamente, convertendo-os automaticamente para o formato JSON Schema exigido pelo protocolo MCP.
  - Reduz drasticamente código boilerplate de mapeamento manual de JSON-RPC `tools/list` e `tools/call`.
  - Permite desacoplamento da camada de transporte, possibilitando o uso de `StdioServerTransport` para o runtime executável e `InMemoryTransport` para testes unitários determinísticos, rápidos e 100% offline.
- **Alternativas Consideradas**:
  - `Server` de baixo nível (`@modelcontextprotocol/sdk/server/index.js`): Requer tratamento manual de requests `ListToolsRequestSchema` e `CallToolRequestSchema`, além de conversão manual de Zod para JSON Schema. Descartado por complexidade desnecessária.

---

## 2. Reutilização de Schemas Zod e Fonte Única de Verdade

### Decisão: Schemas Canônicos Centralizados em `src/schemas/tools.ts`
- **Decisão**: Extrair e centralizar os schemas de entrada das ferramentas operacionais (`ListAlertsInputSchema`, `OpenIncidentInputSchema`, `ResolveIncidentInputSchema`) em `src/schemas/tools.ts` (ou exportá-los formalmente para reutilização).
- **Justificativa**:
  - O requisito não-negociável estipula "uma única fonte de verdade".
  - Tanto as ferramentas LangChain (`src/agents/tools.ts`) quanto o servidor MCP (`src/mcp/server.ts`) consumirão exatamente as mesmas instâncias de validação Zod.
  - Mudanças em regras de validação (ex.: severidades permitidas, tamanhos mínimos de string, valores padrão) propagam-se instantaneamente para ambos os pontos de entrada do sistema.
- **Alternativas Consideradas**:
  - Redefinir schemas no servidor MCP: Quebraria o princípio de fonte única de verdade e geraria débito técnico de sincronização manual.

---

## 3. Isolamento Estrito do Canal stdio e Diagnóstico Seguro

### Decisão: Redirecionamento Total de Diagnósticos para `stderr`
- **Decisão**: Nenhuma chamada a `console.log` pode ocorrer dentro de `src/mcp/server.ts` ou módulos acessados por ele em tempo de execução MCP. Todo log operacional, aviso ou rastro de erro deve utilizar `console.error`.
- **Justificativa**:
  - No transporte `stdio`, a stream `stdout` é o canal exclusivo de comunicação serializada JSON-RPC entre o servidor MCP e o cliente host (ex.: Claude Desktop, Cursor, CLI do agente).
  - Qualquer caractere não empacotado em uma mensagem JSON-RPC enviado para `stdout` corrompe o parser do cliente, causando falha imediata na sessão.
  - A stream `stderr` é reservada para logs de depuração do processo e é ignorada pelo parser do protocolo MCP no cliente host.
- **Alternativas Consideradas**:
  - Sobrescrever `console.log = console.error` no ponto de entrada do servidor: Útil como salvaguarda defensiva, mas a regra deve ser mantida no código-fonte para clareza e previsibilidade.

---

## 4. Testabilidade e Isolamento sem Dependência de Rede

### Decisão: Testes Unitários via `InMemoryTransport` e Teste de Integração com Subprocesso
- **Decisão**:
  1. Fornecer uma fábrica `createMcpServer(opsStore?: OpsStore)` para montagem modular do servidor.
  2. Testes de unidade conectarão um `Client` MCP oficial utilizando `InMemoryTransport.createLinkedPair()`. Isso valida a listagem de tools (`tools/list`), metadados e execução (`tools/call`) em microssegundos sem abrir sockets ou processos filhos.
  3. Teste de fumaça de integração com `node:child_process` (spawn) validando que o script inicializa sem poluir `stdout` com mensagens espúrias antes do handshake.
- **Justificativa**:
  - Segue o Princípio 4 da Constituição: testes com `node:test` nativo, determinísticos e 100% offline.

---

## 5. Resumo das Decisões Técnicas

| Item | Escolha | Racional |
|---|---|---|
| Pacote MCP | `@modelcontextprotocol/sdk` (`^1.6.0` / `^1.30.0`) | Biblioteca oficial padronizada para TypeScript |
| Classe Servidor | `McpServer` (`@modelcontextprotocol/sdk/server/mcp.js`) | Suporte nativo e fluido a schemas Zod |
| Transporte Produção | `StdioServerTransport` | Comunicação padrão para clientes locais e IDEs |
| Transporte Testes | `InMemoryTransport.createLinkedPair()` | Testes ultrarrápidos, determinísticos e sem IO |
| Persistência | `OpsStore` compartilhado via `src/agents/ops-store.ts` | Estado consistente em todo o sistema |
| Canal de Log | `console.error` (stderr) | Preservação da integridade do canal JSON-RPC (stdout) |
| Script NPM | `mcp = "tsx --env-file=.env src/mcp/server.ts"` | Carga nativa de variáveis de ambiente do Node.js |
