# Contract: Endpoint HTTP `POST /chat` (Com Histórico Persistente)

Este contrato atualiza a especificação da rota `POST /chat` para incorporar `conversationId` e a métrica `historyMessages`.

---

## Endpoint: `POST /chat`

Submete uma mensagem em linguagem natural para processamento pelo agente, mantendo histórico persistente de sessão.

### Headers
- `Content-Type: application/json` (obrigatório)

---

### Request Body

```json
{
  "message": "string (obrigatório, não vazio)",
  "strategy": "string (opcional, padrão: 'react')",
  "reflect": "boolean (opcional, padrão: false)",
  "conversationId": "string (opcional, identificador de conversa anterior)"
}
```

#### Exemplos de Request Body:

```json
// 1. Primeira mensagem (nova conversa iniciada automaticamente)
{
  "message": "Quantos alertas críticos estão disparando no momento?"
}

// 2. Continuidade de conversa existente
{
  "message": "Abra um incidente para o primeiro desses alertas",
  "conversationId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

---

### Respostas

#### 1. `200 OK`
Execução concluída com sucesso.

**Payload**:
```json
{
  "conversationId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "answer": "Abri o incidente inc-001 para o alerta crítico do payment-gateway.",
  "trace": [
    {
      "type": "thought",
      "content": "Consultando histórico e executando ação...",
      "timestamp": "2026-10-04T22:30:00.000Z"
    },
    {
      "type": "answer",
      "content": "Abri o incidente inc-001 para o alerta crítico do payment-gateway.",
      "timestamp": "2026-10-04T22:30:01.000Z"
    }
  ],
  "metrics": {
    "llmCalls": 1,
    "latencyMs": 350,
    "historyMessages": 2
  }
}
```

---

#### 2. `400 Bad Request`
Parâmetros de entrada inválidos (ex.: `message` vazio ou `conversationId` em branco).

**Payload**:
```json
{
  "error": "Bad Request",
  "message": "Corpo da requisição inválido",
  "issues": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "message": "O campo 'message' não pode ser vazio",
      "path": ["message"]
    }
  ]
}
```

---

#### 3. `422 Unprocessable Entity`
Estratégia desconhecida.

---

#### 4. `504 Gateway Timeout`
Execução excedeu o tempo limite configurado.

---

#### 5. `500 Internal Server Error`
Falha interna do servidor ou erro no banco de dados.
