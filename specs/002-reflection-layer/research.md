# Research: Camada Reflection para Estratégias de Raciocínio

**Feature**: Camada Reflection (`withReflection`, Crítico, Arena `reflect:*`)  
**Spec**: [spec.md](./spec.md)  
**Date**: 2026-09-08

---

## 1. Padrão Decorator para Estratégias (`withReflection`)

### Contexto
O OpsPilot possui um contrato unificado `ReasoningStrategy` que já implementa estratégias como `react` e `plan-and-execute`. A reflexão (crítica e auto-correção) não deve ficar acoplada internamente ao grafo de cada estratégia, mas sim atuar de maneira transversal e intercambiável sobre qualquer estratégia existente ou futura.

### Decisão
Implementar a função de ordem superior `withReflection(strategy: ReasoningStrategy, options?: ReflectionOptions): ReasoningStrategy` em `src/agents/reflection.ts`.
- Retorna um novo objeto implementando `ReasoningStrategy`.
- `name`: `reflect:${strategy.name}` (ex.: `reflect:react`, `reflect:plan-and-execute`).
- Executa a estratégia base, intercepta o resultado e aciona o loop de avaliação crítica.

### Alternativas Consideradas
- **Nós de reflexão embutidos dentro de cada grafo**: Rejeitado por duplicar lógica entre ReAct e Plan-and-Execute e violar o princípio de responsabilidade única (SRP).
- **Middleware externo no Express/HTTP**: Rejeitado porque a reflexão é um padrão cognitivo do agente que precisa funcionar também na Arena CLI e em testes isolados.

---

## 2. Modelagem do Crítico e Esquema de Avaliação (`CritiqueSchema`)

### Contexto
O crítico precisa analisar a resposta sintetizada pela APO e verificar se ela é factualmente consistente com os dados retornados pelas ferramentas operacionais (alertas reais, serviços impactados, IDs gerados) presentes no `trace`.

### Decisão
- Definir o schema com Zod:
  ```typescript
  export const CritiqueSchema = z.object({
    approved: z.boolean().describe("true se a resposta for factualmente precisa e completa contra as observações, false caso contrário"),
    feedback: z.string().describe("Justificativa da aprovação ou apontamentos concretos de correção"),
  });
  export type CritiqueResult = z.infer<typeof CritiqueSchema>;
  ```
- O crítico utiliza a fábrica centralizada `createModel()` com `temperature: 0`.
- O prompt do crítico recebe:
  1. `Objetivo do Usuário`: o input original.
  2. `Observações Factuais`: lista concatenada de todos os eventos com `type === "observation"` do trace.
  3. `Resposta Proposta`: o texto em `result.answer`.
- **Proteção contra Falhas de Parse**: Implementar fallback resiliente. Se a resposta da LLM não puder ser parseada ou vier vazia, o sistema registra um aviso no log e assume aprovação ou feedback seguro, evitando travar o fluxo.

### Alternativas Consideradas
- **Uso de modelo menor ou heurística regex**: Rejeitado para o crítico, pois avaliar fidelidade e omissões requer capacidade semântica de raciocínio.
- **Crítica binária sem feedback textual**: Rejeitado porque a regeneração precisa saber exatamente o que corrigir.

---

## 3. Loop de Auto-Correção e Injeção de Feedback

### Contexto
Se o crítico reprovar (`approved === false`), o sistema precisa reexecutar a estratégia corrigindo os desvios, limitando o número de tentativas para evitar custos excessivos ou loops infinitos.

### Decisão
- Parâmetro `maxReflections`: padrão estrito de `2` (máximo de 2 rodadas de crítica/regeneração).
- Fluxo por ciclo:
  1. Executa a estratégia com o input da rodada.
  2. Se for a 1ª rodada: input é o original do usuário.
  3. Se for rodada regenerada: input combina o objetivo original com as observações factuais e o feedback específico do crítico anterior.
  4. Extrai observações do trace gerado e submete ao crítico.
  5. Adiciona evento com `type: "critique"` ao trace consolidado:
     - Conteúdo: `[${approved ? "APROVADO" : "REPROVADO"}] ${feedback}`.
  6. Se `approved === true` ou `round >= maxReflections`: encerra e retorna a resposta.
  7. Se `approved === false` e `round < maxReflections`: prepara a próxima rodada com o novo feedback.

---

## 4. Consolidação de Traces e Métricas Cumulativas

### Contexto
O usuário precisa enxergar no trace final toda a jornada cognitiva (ações da 1ª rodada, crítica, ações de correção, crítica de aprovação e resposta final) e saber o consumo total de chamadas LLM e latência.

### Decisão
- **Traces**: Todos os eventos da estratégia base de cada ciclo são acumulados sequencialmente no array `trace`, intercalados pelos eventos `type: "critique"`.
- **Métricas**:
  - `llmCalls`: soma acumulada das chamadas de cada execução da estratégia base + 1 chamada por rodada do crítico.
  - `latencyMs`: tempo de relógio total desde o início da primeira execução até a aprovação ou interrupção final (`Date.now() - started`).

---

## 5. Exposição na Arena CLI (`src/arena.ts`)

### Contexto
Permitir aos engenheiros comparar diretamente `react` vs `reflect:react` e `plan-and-execute` vs `reflect:plan-and-execute`.

### Decisão
- Em `src/arena.ts`, registrar:
  - `"reflect:react"`: `withReflection(reactStrategy)`
  - `"reflect-react"`: alias amigável
  - `"reflect:plan-and-execute"`: `withReflection(planAndExecuteStrategy)`
  - `"reflect:plan-execute"` e `"reflect-plan-and-execute"`: aliases amigáveis
