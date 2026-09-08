# Contract: Endpoint HTTP `POST /chat`

Este contrato define a especificação do endpoint HTTP exposto pelo OpsPilot para comunicação síncrona com os agentes.

---

## Endpoint: `POST /chat`

Submete um comando ou pergunta operacional em linguagem natural para execução por uma estratégia de raciocínio da APO.

### Headers
- `Content-Type: application/json` (obrigatório)

---

### Request Body

```json
{
  "message": "string (obrigatório, não vazio)",
  "strategy": "string (opcional, padrão: 'react')",
  "reflect": "boolean (opcional, padrão: false)"
}
```

#### Exemplos de Request Body:
```json
// Mínimo (usa react, sem reflexão)
{
  "message": "Quantos alertas críticos estão disparando?"
}

// Completo (usa plan-and-execute com reflexão)
{
  "message": "Abra um incidente para o alerta mais antigo",
  "strategy": "plan-and-execute",
  "reflect": true
}
```

---

### Respostas

#### 1. `200 OK`
Execução concluída com sucesso.

**Payload**:
```json
{
  "answer": "Identifiquei 1 alerta crítico ativo no serviço payment-gateway.",
  "trace": [
    {
      "type": "thought",
      "content": "Consultando ferramentas de alerta...",
      "timestamp": "2026-09-08T00:00:00.000Z"
    },
    {
      "type": "action",
      "content": "Chamada da ferramenta list_alerts",
      "tool": "list_alerts",
      "args": { "status": "firing" },
      "timestamp": "2026-09-08T00:00:01.000Z"
    },
    {
      "type": "observation",
      "content": "[{\"id\":\"alt-001\",\"severity\":\"critical\"}]",
      "tool": "list_alerts",
      "timestamp": "2026-09-08T00:00:02.000Z"
    },
    {
      "type": "answer",
      "content": "Identifiquei 1 alerta crítico ativo no serviço payment-gateway.",
      "timestamp": "2026-09-08T00:00:03.000Z"
    }
  ],
  "metrics": {
    "llmCalls": 2,
    "latencyMs": 420
  }
}
```

---

#### 2. `400 Bad Request`
O corpo da requisição é inválido ou violou as restrições do Zod.

**Payload**:
```json
{
  "error": "Bad Request",
  "message": "Parâmetros da requisição inválidos",
  "issues": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "O campo 'message' não pode ser vazio",
      "path": ["message"]
    }
  ]
}
```

---

#### 3. `422 Unprocessable Entity`
A estratégia especificada no corpo da requisição não foi encontrada no `StrategyRegistry`.

**Payload**:
```json
{
  "error": "Unprocessable Entity",
  "message": "Estratégia desconhecida: 'desconhecida'. Estratégias disponíveis: react, plan-and-execute"
}
```

---

#### 4. `504 Gateway Timeout`
O tempo de execução da estratégia excedeu o tempo limite configurado (padrão 180 segundos).

**Payload**:
```json
{
  "error": "Gateway Timeout",
  "message": "A execução da estratégia excedeu o tempo limite de 180 segundos."
}
```

---

#### 5. `500 Internal Server Error`
Ocorreu uma falha interna inesperada durante o processamento da requisição.

**Payload**:
```json
{
  "error": "Internal Server Error",
  "message": "Erro interno durante a execução do agente."
}
```
