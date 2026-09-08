# Contract: Arena CLI Interface

Este contrato define a interface da CLI de avaliação de raciocínio executada via `npm run arena` (`src/arena.ts`).

---

## 1. Assinatura de Execução

```bash
npm run arena -- [opções]
# ou
tsx src/arena.ts [opções]
```

## 2. Argumentos e Flags

| Flag | Tipo | Padrão | Descrição |
|---|---|---|---|
| `--strategies` | `string` | `"react,plan-and-execute"` | Lista separada por vírgula das estratégias a executar. Opções aceitas: `react`, `plan-and-execute`. |
| `--max-iterations` | `number` | `8` | Limite máximo de iterações/passos permitidos por estratégia. |
| `--prompt` ou `--input` | `string` | Cenário padrão de incidente | Texto de instrução/alerta que servirá de entrada comum para as estratégias. |
| `--help` | `boolean` | `false` | Exibe a ajuda da linha de comando com a sintaxe de uso. |

## 3. Formato da Saída no Terminal

Para cada estratégia executada, a CLI emite sequencialmente:

```text
============================================================
🤖 Estratégia: ReAct
============================================================
[TRACE] [THOUGHT] Identificando alertas ativos no sistema...
[TRACE] [ACTION] list_alerts({ status: "firing" })
[TRACE] [OBSERVATION] 3 alertas ativos encontrados: alt-001, alt-002, alt-003.
[TRACE] [THOUGHT] O alerta alt-001 é crítico. Abrindo incidente...
[TRACE] [ACTION] open_incident({ title: "...", service: "payment-gateway", severity: "critical" })
[TRACE] [OBSERVATION] Incidente inc-123 aberto com sucesso.
[TRACE] [ANSWER] Foram identificados 3 alertas ativos. O incidente inc-123 foi aberto para o serviço payment-gateway com severidade crítica.

📊 Métricas:
  - Chamadas de LLM: 3
  - Latência total: 1840 ms
```

Ao final, imprime o sumário comparativo:

```text
============================================================
🏁 Sumário Comparativo da Arena
============================================================
| Estratégia        | Chamadas LLM | Latência (ms) | Status  |
|-------------------|--------------|---------------|---------|
| ReAct             | 3            | 1840          | Sucesso |
| Plan-and-Execute  | 5            | 3120          | Sucesso |
============================================================
```

## 4. Códigos de Saída (Exit Codes)

- `0`: Execução finalizada com sucesso em todas as estratégias solicitadas.
- `1`: Argumentos inválidos (ex.: estratégia não reconhecida) ou erro fatal não recuperável de configuração.
