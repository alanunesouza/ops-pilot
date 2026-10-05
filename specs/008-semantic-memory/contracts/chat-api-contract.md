# Contract: Endpoint HTTP `POST /chat` (Com Suporte a `userId`)

Este contrato documenta a extensão do endpoint `POST /chat` para personalização e injeção automática de memórias semânticas.

---

## Endpoint: `POST /chat`

### Request Body

```json
{
  "message": "string (obrigatório, não vazio)",
  "strategy": "string (opcional, padrão: 'react')",
  "reflect": "boolean (opcional, padrão: false)",
  "conversationId": "string (opcional, id da conversa)",
  "userId": "string (opcional, id do operador)"
}
```

#### Exemplo com `userId`:

```json
{
  "message": "Qual é a minha preferência de atendimento para incidentes de banco?",
  "userId": "usr-thiago-123"
}
```

---

### Injeção no Prompt do Agente

Quando `userId` estiver presente e houver fatos recuperados via `recall(userId, message, 3)`:

```text
[Memórias do Operador]
- O operador prefere mitigação imediata via chaveamento de tráfego antes de reiniciar pods.
- O operador é responsável direto pelos serviços auth e payment.

[Histórico da Conversa]
User: ...
Assistant: ...

[Mensagem Atual]
Qual é a minha preferência de atendimento para incidentes de banco?
```

---

### Resposta: `200 OK`

O formato do payload de resposta permanece estruturalmente compatível com `ChatResponse`:
- `conversationId`: string
- `answer`: string
- `trace`: array
- `metrics`: objeto contendo `llmCalls`, `latencyMs`, `historyMessages`
