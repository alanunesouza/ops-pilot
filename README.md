# OpsPilot 🧑‍✈️🚨

Copiloto inteligente de plantão (on-call) para gestão, diagnóstico e mitigação de alertas e incidentes de produção. O núcleo do sistema é a **APO** (Agente de Produção e Operações), implementada sobre LangChain e LangGraph com suporte a múltiplos padrões de raciocínio autônomo e observabilidade estrita.

---

## 🏗️ Arquitetura do Núcleo de Raciocínio

```
                               ┌────────────────────────┐
                               │     CLI da Arena       │
                               │     (src/arena.ts)     │
                               └───────────┬────────────┘
                                           │
                 ┌─────────────────────────┴─────────────────────────┐
                 │                                                   │
                 ▼                                                   ▼
     ┌───────────────────────┐                           ┌───────────────────────┐
     │   Estratégia ReAct    │                           │   Plan-and-Execute    │
     │   (src/agents/react)  │                           │   (LangGraph State)   │
     └───────────┬───────────┘                           └───────────┬───────────┘
                 │                                                   │
                 │   thought | action | observation | critique       │
                 └─────────────────────────┬─────────────────────────┘
                                           │
                                           ▼
                                ┌────────────────────────┐
                                │   Ferramentas (Tools)  │
                                │   (src/agents/tools)   │
                                │ list_alerts            │
                                │ open_incident          │
                                │ resolve_incident       │
                                │ list_incidents         │
                                │ consultar_runbook      │
                                │ check_provider_status  │
                                └───────────┬────────────┘
                                            │
                                            ▼
                                ┌────────────────────────┐
                                │     SqliteOpsStore     │
                                │(node:sqlite / OPSPILOT)│
                                │services, alerts,       │
                                │incidents, runbooks     │
                                └────────────────────────┘
```

### Ferramentas Operacionais (`opsTools`)
Todas as ferramentas seguem as 6 regras semânticas (nome claro, "Use quando", "NÃO use", schemas Zod com `.describe()` e erros como observações textuais):
- `list_alerts`: Consulta alertas de monitoramento (`firing`, `resolved`, `all`).
- `open_incident`: Abre novo chamado formal de incidente com severidade (`low`, `medium`, `high`, `critical`).
- `resolve_incident`: Encerra incidente com sumário de mitigação.
- `list_incidents`: Lista incidentes abertos ou resolvidos.
- `consultar_runbook`: Recupera procedimentos de remediação operacional por serviço.
- `check_provider_status`: Consulta a statuspage pública oficial de provedores externos (`github`, `cloudflare`) via statuspage.io com timeout de 5s, retry automático em 5xx/rede e retorno amigável como observação.

---

## 🚀 Comandos Rápidos

### 1. Inicializar Seed Primário (SQLite)
Carrega 5 serviços de infraestrutura, 6 alertas simulados (3 `firing` e 3 `resolved`) e 3 runbooks operacionais no SQLite (`./data/opspilot.db`):
```bash
npm run seed
```

### 2. Executar a Suíte de Testes Determinísticos
Roda a suíte completa de testes unitários nativos com `node:test` (100% offline, sem rede e em < 1 segundo):
```bash
npm test
```

### 3. Checagem Estática de Tipos (TypeScript)
```bash
npm run typecheck
```

### 4. Executar a Arena de Raciocínio
Executa o comparativo de estratégias lado a lado, incluindo estratégias base e refletidas:
```bash
npm run arena
```

#### Opções da Arena:
```bash
# Executar apenas ReAct com limite de 5 iterações:
npm run arena -- --strategies react --max-iterations 5

# Executar ReAct com Camada Reflection:
npm run arena -- "quantos alertas críticos estão disparando" --strategies "reflect:react"

# Comparar ReAct base vs Reflected ReAct lado a lado:
npm run arena -- "analise os alertas de payment e abra incidentes" --strategies "react,reflect:react"

# Executar Plan-and-Execute com Reflection:
npm run arena -- --strategies "reflect:plan-and-execute" --prompt "Verifique alertas críticos e abra incidentes necessários"
```

### 5. Executar o Benchmark Operacional (`bench.ts`)
Avalia 3 cenários operacionais contra 2 estratégias (`react`, `plan-and-execute`) com verificação direta no estado do `store`:
```bash
npm run bench
```

#### Opções do Benchmark:
```bash
# Executar apenas o cenário C1 (direto):
npm run bench -- --scenario C1

# Executar apenas o cenário C2 (estruturado):
npm run bench -- --scenario C2

# Executar com replanner desativado no plan-and-execute:
npm run bench -- --no-replanner
```

### 6. Executar o Servidor HTTP da API de Chat (`POST /chat`)
Inicia o servidor Express v5 na porta definida por `PORT` (padrão 3000):
```bash
npm run dev
```

#### Exemplos de Requisição (`curl`):
```bash
# Consulta padrão (estratégia react, sem reflexão)
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Quantos alertas críticos estão disparando?"}'

# Consulta com estratégia Plan-and-Execute e Camada Reflection ativa
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Abra um incidente para o alerta mais antigo", "strategy": "plan-and-execute", "reflect": true}'
```

### 7. Executar o Servidor MCP (Model Context Protocol)
Inicia o servidor MCP oficial do OpsPilot (`src/mcp/server.ts`) sobre o transporte `stdio`, expondo as ferramentas `list_alerts`, `open_incident` e `resolve_incident`:
```bash
npm run mcp
```

> **Nota**: `stdout` é reservado exclusivamente para o protocolo JSON-RPC. Todos os diagnósticos vão para `stderr`.

#### Configuração para Claude Desktop / Cursor:
Adicione ao seu `claude_desktop_config.json`:
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

## 🪞 Camada Reflection (`withReflection`)

A camada de reflexão implementa o padrão Decorator sobre qualquer `ReasoningStrategy` (como `react` ou `plan-and-execute`):

- **Auto-avaliação Crítica**: Submete a resposta e as observações factuais do trace a um crítico LLM com saída estruturada (`verdictSchema`: `{ approved: boolean, feedback: string }`).
- **Regeneração sob Feedback**: Caso o crítico reprove a resposta (`approved: false`), aciona uma nova iteração injetando o feedback corretivo e as observações no contexto.
- **Teto Estrito (`maxReflections`)**: Respeita o limite configurado (padrão: 2 rodadas) para evitar loops infinitos.
- **Rastreabilidade**: Registra cada avaliação como um evento `[TRACE] [CRITIQUE]` no trace consolidado e agrega métricas acumulativas de chamadas LLM e latência total.


---

## 🔒 Segurança e Governança

- **Variáveis de Ambiente**: Configuradas em `.env` (exemplo em `.env.example`).
- **Validação Estrita com Zod**: Em toda entrada de ferramentas e persistência de dados.
- **Teto Operacional**: O grafo Plan-and-Execute possui limite fixo e seguro de no máximo 8 passos.
