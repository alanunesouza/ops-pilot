# Contract: Operational Tools Interface

Este contrato define as ferramentas LangChain operacionais disponibilizadas para os agentes em `src/agents/tools.ts`.

---

## 1. `list_alerts`

Permite ao agente consultar o catálogo de alertas operacionais ativos ou históricos.

### Entrada (Zod Schema)
```typescript
z.object({
  status: z.enum(["firing", "resolved"]).optional().describe("Filtra alertas pelo status operacional (firing ou resolved)"),
})
```

### Saída
```json
[
  {
    "id": "alt-001",
    "service": "payment-gateway",
    "title": "High error rate (5xx) in checkout transactions",
    "severity": "critical",
    "status": "firing",
    "timestamp": "2026-09-06T14:30:00.000Z"
  }
]
```

---

## 2. `open_incident`

Permite ao agente abrir formalmente um incidente associado a um serviço e severidade.

### Entrada (Zod Schema)
```typescript
z.object({
  title: z.string().min(1).describe("Título descritivo do incidente"),
  service: z.string().min(1).describe("Nome do serviço impactado"),
  severity: z.enum(["low", "medium", "high", "critical"]).describe("Nível de severidade operacional"),
})
```

### Saída
```json
{
  "id": "inc-m0912k-82ab",
  "title": "Degradação crítica em pagamentos",
  "service": "payment-gateway",
  "severity": "critical",
  "status": "open",
  "createdAt": "2026-09-06T15:00:00.000Z",
  "updatedAt": "2026-09-06T15:00:00.000Z"
}
```

---

## 3. `resolve_incident`

Permite ao agente marcar um incidente previamente aberto como resolvido após a conclusão das ações de remediação.

### Entrada (Zod Schema)
```typescript
z.object({
  id: z.string().min(1).describe("Identificador do incidente a ser resolvido"),
})
```

### Saída
```json
{
  "id": "inc-m0912k-82ab",
  "title": "Degradação crítica em pagamentos",
  "service": "payment-gateway",
  "severity": "critical",
  "status": "resolved",
  "createdAt": "2026-09-06T15:00:00.000Z",
  "updatedAt": "2026-09-06T15:15:00.000Z"
}
```

### Tratamento de Erros
Se o incidente não for encontrado, a ferramenta não deve lançar exceção não capturada; ela retorna uma mensagem estruturada clara:
`"Erro: Incidente com id 'inc-xxx' não encontrado."`, permitindo que o agente processe o feedback e ajuste o plano.
