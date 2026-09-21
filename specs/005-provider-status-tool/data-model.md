# Data Model & Schemas: Ferramenta de Status de Provedores Externos

**Feature**: `005-provider-status-tool`  
**Date**: 2026-09-20  
**Status**: Completed  

## 1. Schemas Zod de Validação na Fronteira

### Schema de Entrada da Ferramenta (`ProviderStatusInputSchema`)

```typescript
import { z } from "zod";

export const ProviderEnumSchema = z.enum(["github", "cloudflare"]);
export type ProviderEnum = z.infer<typeof ProviderEnumSchema>;

export const ProviderStatusInputSchema = z.object({
  provider: ProviderEnumSchema.default("github").describe(
    "Identificador do provedor externo a consultar: 'github' ou 'cloudflare'. Padrão: 'github'."
  ),
});
export type ProviderStatusInput = z.infer<typeof ProviderStatusInputSchema>;
```

### Schema de Validação da Resposta da Statuspage (`StatuspageResponseSchema`)

```typescript
export const StatuspageResponseSchema = z.object({
  status: z.object({
    indicator: z.string().describe("Indicador operacional do provedor: 'none', 'minor', 'major', 'critical'"),
    description: z.string().describe("Descrição textual do estado atual dos serviços do provedor"),
  }),
});
export type StatuspageResponse = z.infer<typeof StatuspageResponseSchema>;
```

---

## 2. Catálogo e Configuração dos Provedores

```typescript
export const PROVIDER_ENDPOINTS: Record<ProviderEnum, string> = {
  github: "https://www.githubstatus.com/api/v2/status.json",
  cloudflare: "https://www.cloudflarestatus.com/api/v2/status.json",
};
```

---

## 3. Diagrama de Sequência e Fluxo de Resiliência

```mermaid
sequenceDiagram
    autonumber
    actor APO as Agente (APO / LangChain)
    participant Tool as check_provider_status
    participant HTTP as Cliente HTTP (fetch)
    participant External as Statuspage.io (GitHub / Cloudflare)

    APO->>Tool: invoke({ provider: "github" })
    Note over Tool: Inicia Tentativa 1 com AbortSignal.timeout(5000)
    Tool->>HTTP: fetch(url, { signal })
    alt Sucesso na Tentativa 1
        HTTP->>External: GET /api/v2/status.json
        External-->>HTTP: 200 OK + JSON
        HTTP-->>Tool: Response (200 OK)
        Tool->>Tool: Validar com StatuspageResponseSchema
        Tool-->>APO: "[github] indicator: none | description: All Systems Operational"
    else Falha de Rede, Timeout ou HTTP 5xx na Tentativa 1
        HTTP--xTool: Erro de Timeout / 5xx
        Note over Tool: Dispara Tentativa 2 (Retry Único)
        Tool->>HTTP: fetch(url, { signal })
        alt Sucesso na Tentativa 2
            HTTP->>External: GET /api/v2/status.json
            External-->>HTTP: 200 OK + JSON
            HTTP-->>Tool: Response (200 OK)
            Tool->>Tool: Validar com StatuspageResponseSchema
            Tool-->>APO: "[github] indicator: none | description: All Systems Operational"
        else Falha persistente na Tentativa 2
            HTTP--xTool: Falha na 2ª tentativa
            Note over Tool: Converte falha em observação legível (sem lançar erro)
            Tool-->>APO: "[github] Falha ao consultar statuspage: <motivo da falha>"
        end
    end
```
