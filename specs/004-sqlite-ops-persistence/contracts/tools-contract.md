# Contract: Especificação Semântica das Ferramentas da APO (`src/agents/tools.ts`)

**Feature**: `004-sqlite-ops-persistence`
**Date**: 2026-09-20
**Status**: Completed

Este documento estabelece o contrato das 5 ferramentas LangChain disponibilizadas para a APO, padronizadas rigorosamente conforme as **6 Regras de Engenharia de Ferramentas**:

1. **Objetivo Operacional Claro**: Declaração direta do que a tool faz.
2. **Quando Usar (Gatilhos)**: Casos de uso específicos e intenções do usuário.
3. **Quando NÃO Usar (Fronteiras)**: Limites explícitos e qual ferramenta alternativa utilizar.
4. **Descrição por Campo (`.describe()`)**: Cada parâmetro do schema documentado com clareza.
5. **Enums Estritos com Defaults**: Valores aceitos explícitos e valores padrão.
6. **Formato de Retorno Previsível**: Estrutura JSON ou mensagem consistente.

---

## 1. Ferramenta `list_alerts`

- **Nome**: `list_alerts`
- **Descrição**:
  "Consulta e lista alertas de monitoramento da infraestrutura e serviços. Use quando o operador perguntar sobre o estado do plantão, alertas ativos/disparando, ou histórico recente de alertas resolvidos. NÃO use para listar incidentes abertos (use 'list_incidents') nem para consultar procedimentos operacionais (use 'consultar_runbook')."
- **Schema de Entrada**:
  ```typescript
  z.object({
    status: z
      .enum(["firing", "resolved", "all"])
      .default("firing")
      .describe("Filtro do estado do alerta: 'firing' para alertas ativos no plantão, 'resolved' para alertas normalizados, ou 'all' para todos."),
  })
  ```
- **Formato de Retorno**:
  JSON string contendo array de alertas: `Array<{ id, service, title, severity, status, timestamp }>`.

---

## 2. Ferramenta `open_incident`

- **Nome**: `open_incident`
- **Descrição**:
  "Abre formalmente um novo incidente operacional em produção para um serviço impactado. Use quando houver um problema ativo, alerta crítico confirmado que exige intervenção humana, ou solicitação explícita do operador para abrir chamado. NÃO use para consultar incidentes abertos (use 'list_incidents'), para alertas já resolvidos, ou quando houver apenas dúvidas sem impacto real."
- **Schema de Entrada**:
  ```typescript
  z.object({
    title: z.string().min(1).describe("Título descritivo e conciso do incidente operacional."),
    service: z.string().min(1).describe("Identificador do serviço impactado (ex.: 'payment-gateway', 'auth-service')."),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .describe("Nível de severidade operacional do incidente."),
  })
  ```
- **Formato de Retorno**:
  JSON string com o incidente aberto: `{ id, title, service, severity, status: "open", createdAt, updatedAt }` ou mensagem de erro estruturada.

---

## 3. Ferramenta `resolve_incident`

- **Nome**: `resolve_incident`
- **Descrição**:
  "Marca um incidente operacional previamente aberto como resolvido após aplicação de ação corretiva. Use quando o problema reportado tiver sido mitigado e o plantão puder dar baixa na ocorrência. NÃO use se o serviço continuar apresentando instabilidade ou se o incidente ainda não foi aberto (use 'open_incident')."
- **Schema de Entrada**:
  ```typescript
  z.object({
    id: z.string().min(1).describe("Identificador único do incidente a ser encerrado (ex.: 'inc-xxx')."),
    summary: z.string().optional().describe("Resumo ou justificativa opcional descrevendo a ação corretiva aplicada."),
  })
  ```
- **Formato de Retorno**:
  JSON string com o incidente atualizado: `{ id, title, service, severity, status: "resolved", createdAt, updatedAt, resolvedAt, summary }` ou mensagem amigável de erro caso o ID não exista.

---

## 4. Ferramenta `list_incidents` (NOVA)

- **Nome**: `list_incidents`
- **Descrição**:
  "Lista os incidentes operacionais registrados no sistema com filtro por status. Use quando o operador perguntar quais incidentes estão em andamento, abertos, ou histórico de incidentes já resolvidos. NÃO use para inspecionar alertas de telemetria brutos (use 'list_alerts') nem para consultar procedimentos de remediação (use 'consultar_runbook')."
- **Schema de Entrada**:
  ```typescript
  z.object({
    status: z
      .enum(["open", "resolved", "all"])
      .default("open")
      .describe("Filtro por status do incidente: 'open' para pendentes de mitigação, 'resolved' para encerrados, ou 'all' para todos."),
  })
  ```
- **Formato de Retorno**:
  JSON string contendo array de incidentes com todos os atributos de ciclo de vida.

---

## 5. Ferramenta `consultar_runbook` (NOVA)

- **Nome**: `consultar_runbook`
- **Descrição**:
  "Recupera o guia operacional padrão (runbook) contendo diagnóstico e passos recomendados de remediação para um serviço específico. Use quando identificar um alerta ou incidente em um serviço e precisar do procedimento técnico para mitigação. NÃO use para checar status de alertas (use 'list_alerts') nem para registrar incidentes (use 'open_incident')."
- **Schema de Entrada**:
  ```typescript
  z.object({
    service: z.string().min(1).describe("Nome do serviço a consultar o runbook (ex.: 'checkout', 'payments', 'auth-service')."),
  })
  ```
- **Formato de Retorno**:
  Texto formatado com o título e conteúdo do runbook, ou mensagem explicativa clara caso o serviço não possua runbook cadastrado.
