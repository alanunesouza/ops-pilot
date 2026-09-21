# Quickstart: Validação e Execução do Servidor MCP (`006-mcp-server`)

**Feature**: `006-mcp-server`  
**Date**: 2026-09-21  

Guia prático para execução, teste e validação do servidor MCP do OpsPilot.

---

## 1. Pré-requisitos e Dependências

Instalar o SDK oficial do protocolo de contexto:
```bash
npm install @modelcontextprotocol/sdk
```

Certifique-se de que o banco de dados operacional foi populado:
```bash
npm run seed
```

---

## 2. Execução do Servidor MCP via NPM Script

O servidor é executado através da entrada padrão (`stdin`) e saída padrão (`stdout`):

```bash
npm run mcp
```

> **Atenção**: Como o canal `stdout` é reservado para mensagens do protocolo JSON-RPC, ao rodar interativamente no terminal o processo aguardará comandos JSON-RPC do cliente via `stdin`. Mensagens de inicialização ou diagnósticos são emitidas em `stderr`.

---

## 3. Configuração em Clientes MCP (Ex.: Claude Desktop)

Adicione a configuração no arquivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "opspilot": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/caminho/absoluto/para/ops-pilot"
    }
  }
}
```

Ou diretamente via Node/TSX:
```json
{
  "mcpServers": {
    "opspilot": {
      "command": "npx",
      "args": ["tsx", "--env-file=.env", "src/mcp/server.ts"],
      "cwd": "/caminho/absoluto/para/ops-pilot"
    }
  }
}
```

---

## 4. Validação com o MCP Inspector

Você pode inspecionar e testar visualmente as ferramentas expostas sem configurar um cliente complexo:

```bash
npx @modelcontextprotocol/inspector tsx --env-file=.env src/mcp/server.ts
```

1. Abra a URL fornecida pelo inspector no navegador.
2. Verifique que as ferramentas `list_alerts`, `open_incident` e `resolve_incident` aparecem na aba **Tools**.
3. Execute `list_alerts` com `status: "firing"` e valide o retorno JSON dos alertas.

---

## 5. Validação Automatizada Offline (Suíte de Testes)

Para validar a integridade sem abrir processos manuais:

```bash
# Executa checagem de tipos
npm run typecheck

# Executa testes automatizados (incluindo teste do servidor MCP)
npm test
```
