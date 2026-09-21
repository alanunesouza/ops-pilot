# Contract: Especificação de Protocolo do Servidor MCP (`opspilot`)

**Feature**: `006-mcp-server`  
**Date**: 2026-09-21  
**Status**: Completed  

Este documento define o contrato formal do protocolo MCP exposto pelo OpsPilot sobre transporte `stdio`.

---

## 1. Identificação do Servidor

- **Nome Oficial**: `opspilot`
- **Versão**: `1.0.0`
- **Protocolo**: Model Context Protocol (MCP) JSON-RPC 2.0
- **Transporte Padrão**: `stdio` (`process.stdin` / `process.stdout`)
- **Canal de Diagnóstico**: `stderr` (`process.stderr`)

---

## 2. Contrato de Descoberta: `tools/list`

### Requisição JSON-RPC:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Resposta Esperada:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "list_alerts",
        "description": "Consulta e lista alertas de monitoramento da infraestrutura e serviços. Use quando o operador perguntar sobre o estado do plantão, alertas ativos/disparando, ou histórico recente de alertas resolvidos. NÃO use para listar incidentes abertos (use 'list_incidents') nem para consultar procedimentos operacionais (use 'consultar_runbook').",
        "inputSchema": {
          "type": "object",
          "properties": {
            "status": {
              "type": "string",
              "enum": ["firing", "resolved", "all"],
              "default": "firing",
              "description": "Filtro do estado do alerta: 'firing' para alertas ativos no plantão, 'resolved' para alertas normalizados, ou 'all' para todos."
            }
          }
        }
      },
      {
        "name": "open_incident",
        "description": "Abre formalmente um novo incidente operacional em produção para um serviço impactado. Use quando houver um problema ativo, alerta crítico confirmado que exige intervenção humana, ou solicitação explícita do operador para abrir chamado. NÃO use para consultar incidentes abertos (use 'list_incidents'), para alertas já resolvidos, ou quando houver apenas dúvidas sem impacto real.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "description": "Título descritivo e conciso do incidente operacional."
            },
            "service": {
              "type": "string",
              "description": "Identificador do serviço impactado (ex.: 'payment-gateway', 'auth-service', 'order-api')."
            },
            "severity": {
              "type": "string",
              "enum": ["low", "medium", "high", "critical"],
              "description": "Nível de severidade operacional do incidente ('low', 'medium', 'high', 'critical')."
            }
          },
          "required": ["title", "service", "severity"]
        }
      },
      {
        "name": "resolve_incident",
        "description": "Marca um incidente operacional previamente aberto como resolvido após aplicação de ação corretiva. Use quando o problema reportado tiver sido mitigado e o plantão puder dar baixa na ocorrência. NÃO use se o serviço continuar apresentando instabilidade ou se o incidente ainda não foi aberto (use 'open_incident').",
        "inputSchema": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "Identificador único do incidente a ser encerrado (ex.: 'inc-xxx')."
            },
            "summary": {
              "type": "string",
              "description": "Resumo ou justificativa opcional descrevendo a ação corretiva aplicada para mitigação."
            }
          },
          "required": ["id"]
        }
      }
    ]
  }
}
```

---

## 3. Contrato de Invocação: `tools/call`

### 3.1 Invocação de `list_alerts`
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_alerts",
    "arguments": {
      "status": "firing"
    }
  }
}
```
**Resposta:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"id\":\"alt-001\",\"service\":\"payment-gateway\",\"title\":\"High error rate (5xx)\",\"severity\":\"critical\",\"status\":\"firing\"}]"
      }
    ]
  }
}
```

### 3.2 Invocação de `open_incident`
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "open_incident",
    "arguments": {
      "title": "Falha de pagamento na adquirente",
      "service": "payment-gateway",
      "severity": "critical"
    }
  }
}
```
**Resposta:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\":\"inc-12345678-abcd\",\"title\":\"Falha de pagamento na adquirente\",\"service\":\"payment-gateway\",\"severity\":\"critical\",\"status\":\"open\"}"
      }
    ]
  }
}
```

### 3.3 Invocação de `resolve_incident`
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "resolve_incident",
    "arguments": {
      "id": "inc-12345678-abcd",
      "summary": "Circuit breaker normalizado e tráfego migrado"
    }
  }
}
```
**Resposta:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\":\"inc-12345678-abcd\",\"status\":\"resolved\",\"summary\":\"Circuit breaker normalizado e tráfego migrado\"}"
      }
    ]
  }
}
```

---

## 4. Tratamento de Erros e Casos Excepcionais

1. **Incidente Inexistente em `resolve_incident`**:
   - Resposta com `isError: true` e mensagem explícita no bloco de texto, sem interromper o processo:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 5,
     "result": {
       "content": [
         {
           "type": "text",
           "text": "Erro ao resolver incidente: Incidente 'inc-999' não encontrado."
         }
       ],
       "isError": true
     }
   }
   ```

2. **Parâmetros Inválidos**:
   - Falhas de validação Zod geram erro de protocolo JSON-RPC (`-32602 Invalid params`) ou retorno de erro estruturado na tool conforme convenção do SDK.
