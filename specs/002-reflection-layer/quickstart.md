# Quickstart: Validação da Camada Reflection

Este guia orienta a validação prática da camada de auto-avaliação e reflexão (`withReflection`).

---

## 1. Testes Automatizados Unitários (Sem Rede)

Execute a suíte de testes determinísticos locais para validar a camada de reflexão:

```bash
npm test
```

E checagem estática de tipos:

```bash
npm run typecheck
```

**Resultado esperado:**
Validação com mocks cobrindo:
- Aprovação direta pelo crítico (`approved: true`).
- Reprovação e regeneração sob feedback corretivo.
- Parada no teto de `maxReflections` (default: 2).
- Consolidação de métricas (`llmCalls` e `latencyMs`).

---

## 2. Executando a Arena com Estratégias Refletidas

### Cenário 1: ReAct com Reflection
```bash
npm run arena -- "quantos alertas críticos estão disparando" --strategies "reflect:react"
```

**Comportamento esperado:**
1. A estratégia ReAct executa as ferramentas `list_alerts`.
2. O crítico avalia a resposta contra as observações factuais.
3. O trace exibe o evento `[TRACE] [CRITIQUE] [APROVADO] ...`.
4. As métricas refletem a chamada do ReAct + a chamada de avaliação do crítico.

### Cenário 2: Comparação Direta (Base vs Refletida)
```bash
npm run arena -- "analise o alerta crítico e abra um incidente" --strategies "react,reflect:react"
```

A Arena executa sequencialmente as duas abordagens e imprime a tabela comparativa exibindo a diferença de chamadas e eventos de trace gerados pela crítica.

### Cenário 3: Plan-and-Execute com Reflection
```bash
npm run arena -- "verifique alertas de pagamentos" --strategies "reflect:plan-and-execute" --max-iterations 3
```
