# Quickstart: Validação do Núcleo de Raciocínio do OpsPilot

Este guia descreve os passos práticos para inicializar, testar e validar o núcleo de raciocínio da APO de ponta a ponta.

---

## 1. Pré-requisitos

- Node.js 22 LTS instalado.
- Dependências instaladas (`npm install`).
- Variáveis de ambiente configuradas no arquivo `.env` (para execuções da Arena contra LLMs reais):
  ```env
  OPENROUTER_API_KEY=sua_chave_aqui
  OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
  ```

---

## 2. Inicialização do Estado (Seed Primário)

Restaure ou popule o store in-memory com os 5 serviços e 6 alertas (3 firing, 3 resolved):

```bash
npm run seed
```

**Resultado esperado:**
Aparecerá a listagem com 5 serviços cadastrados, 3 alertas `firing` (alt-001, alt-002, alt-003) e 3 alertas `resolved` (alt-004, alt-005, alt-006).

---

## 3. Execução dos Testes Automatizados Determinísticos

Execute a suíte de testes locais sem necessidade de conexão com a internet ou credenciais externas:

```bash
npm test
```

E checagem estática de tipos:

```bash
npm run typecheck
```

**Resultado esperado:**
Todos os testes unitários passando em menos de 5 segundos, cobrindo:
- Seed e operações do store in-memory.
- Invocação e validação de schema das tools (`list_alerts`, `open_incident`, `resolve_incident`).
- Formatação de eventos de trace e cálculo de métricas.

---

## 4. Executando a Arena de Raciocínio

### Cenário 1: Comparação Padrão (ReAct vs Plan-and-Execute)
```bash
npm run arena
```

Executa ambas as estratégias sobre o cenário padrão de incidente, exibindo o trace de raciocínio passo a passo e a tabela comparativa de consumo ao final.

### Cenário 2: Execução com Limite Específico de Iterações
```bash
npm run arena -- --strategies react --max-iterations 4
```

Executa apenas a estratégia ReAct garantindo que o agente encerre respeitando o teto de 4 iterações.

### Cenário 3: Execução de Plan-and-Execute com Entrada Customizada
```bash
npm run arena -- --strategies plan-and-execute --input "Analise todos os alertas do serviço order-api e resolva qualquer incidente pendente"
```

O grafo aciona o `planner`, gera a lista de passos (máx 8), despacha o `executor` para chamar as ferramentas e reavalia via `replanner` até a conclusão.
