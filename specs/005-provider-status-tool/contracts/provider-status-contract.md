# Contract: Especificação Semântica da Ferramenta `check_provider_status`

**Feature**: `005-provider-status-tool`  
**Date**: 2026-09-20  
**Status**: Completed  

Este documento estabelece o contrato formal da ferramenta LangChain `check_provider_status`, em estrita conformidade com as **6 Regras de Engenharia de Ferramentas**.

---

## 1. Definição da Ferramenta `check_provider_status`

- **Identificador (`name`)**: `check_provider_status`
- **Descrição Semântica Completa**:
  "Consulta a statuspage pública oficial de provedores externos essenciais (GitHub e Cloudflare) via API statuspage.io sem necessidade de chave de autenticação. Use quando houver suspeita de que uma instabilidade, lentidão ou queda reportada no plantão é decorrente de degradação em um provedor externo ('é nosso ou do provedor?'), ou quando uma dependência externa parecer fora do ar. NÃO use para verificar alertas ou métricas de serviços internos da nossa própria infraestrutura (use 'list_alerts'), para consultar incidentes abertos (use 'list_incidents') nem para procedimentos de remediação interna (use 'consultar_runbook')."

---

## 2. Schema de Entrada e Tipagem

```typescript
import { z } from "zod";

export const ProviderStatusInputSchema = z.object({
  provider: z
    .enum(["github", "cloudflare"])
    .default("github")
    .describe(
      "Identificador do provedor externo a consultar: 'github' para status do ecossistema GitHub ou 'cloudflare' para rede e edge da Cloudflare. Padrão: 'github'."
    ),
});
```

---

## 3. Formato e Semântica do Retorno

### Retorno em Cenário de Sucesso (HTTP 200 + Schema Válido)
Formato de linha única compacto:
```text
[<provider>] indicator: <indicator> | description: <description>
```
*Exemplos Reais:*
- `[github] indicator: none | description: All Systems Operational`
- `[cloudflare] indicator: minor | description: Minor Service Outage`

### Retorno em Cenário de Falha (Erro como Observação)
Toda falha é capturada e retornada como observação textual com prefixo identificando o provedor, nunca lançando exceção para fora da tool:
```text
[<provider>] Falha ao consultar statuspage: <motivo do erro>
```
*Exemplos Reais:*
- `[github] Falha ao consultar statuspage: Timeout de 5000ms excedido após retentativa.`
- `[cloudflare] Falha ao consultar statuspage: HTTP 500 Internal Server Error após retentativa.`
- `[github] Falha ao consultar statuspage: Resposta da API fora do schema esperado.`

---

## 4. Assinatura da Fábrica com Injeção de Fetch

Para permitir testes determinísticos e desacoplamento de rede:

```typescript
export interface CheckProviderStatusOptions {
  fetchFn?: typeof fetch;
}

export function createCheckProviderStatusTool(options?: CheckProviderStatusOptions): StructuredTool;
```
