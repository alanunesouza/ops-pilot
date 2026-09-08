# Feature Specification: Camada Reflection para Estratégias de Raciocínio

**Feature Branch**: `002-reflection-layer`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Camada Reflection: withReflection (strategy, opts) decora qualquer ReasoningStrategy: executa a base; um crítico (mesmo modelo, saída estruturada {approved, feedback}) avalia a resposta contra as observações do trace; se reprovar, regenera com o feedback no contexto; para em approved ou maxReflections (default 2). Evento "critique" no trace; métricas somam as chamadas extras. Arena: reflect:react e reflect:plan-and-execute"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-avaliação Crítica e Regeneração de Respostas (Priority: P1) 🎯 MVP

Como operador de plantão (on-call), desejo que as respostas geradas pela APO passem por uma verificação crítica automática antes de serem entregues, comparando as conclusões com as observações factuais retornadas pelas ferramentas operacionais, para que omissões, dados incorretos ou inconsistências sejam corrigidos automaticamente sem intervenção humana.

**Why this priority**: Em cenários de produção, decisões baseadas em alucinações ou leituras incorretas de alertas podem agravar incidentes. O loop de reflexão garante integridade e dupla checagem factual.

**Independent Test**: Pode ser testado decorando uma estratégia com `withReflection`, simulando uma resposta inicial incompleta ou imprecisa frente às observações do trace. O crítico deve reprovar (`approved: false`), emitir feedback, acionar uma nova rodada passando a crítica no contexto e retornar a resposta corrigida com `approved: true`.

**Acceptance Scenarios**:

1. **Given** uma estratégia envolvida por `withReflection`, **When** a resposta gerada for consistente e aderente às observações do trace, **Then** o crítico aprova (`approved: true`) e a resposta final é entregue imediatamente com evento de trace correspondente.
2. **Given** uma resposta que omite um alerta crítico observado nas ferramentas, **When** o crítico avalia a saída, **Then** o crítico emite reprovação (`approved: false`) com feedback explicativo, aciona uma nova iteração da estratégia informando o que deve ser corrigido e consolida a resposta final.
3. **Given** uma resposta repetidamente insatisfatória, **When** o número de tentativas atinge o teto `maxReflections` (padrão 2), **Then** a execução é interrompida com segurança, entregando a última síntese acompanhada pelo histórico completo de críticas no trace.

---

### User Story 2 - Rastreabilidade e Auditoria de Eventos de Crítica (Priority: P2)

Como engenheiro de confiabilidade (SRE), desejo inspecionar na trilha de raciocínio todos os eventos do tipo `critique` e auditar as métricas agregadas (chamadas LLM e latência total acumulada), para entender claramente quantas rodadas de reflexão foram necessárias e o custo adicional de auto-correção.

**Why this priority**: O princípio de observabilidade do OpsPilot exige que cada reflexão, avaliação e tempo despendido sejam completamente transparentes e auditáveis.

**Independent Test**: Pode ser testado executando uma consulta que passe por pelo menos uma reprovação, validando que o array `trace` retornado contém eventos tipados como `critique` com o parecer do crítico, e que `metrics.llmCalls` e `metrics.latencyMs` refletem a soma da estratégia base mais as avaliações críticas.

**Acceptance Scenarios**:

1. **Given** uma execução que passou por um ciclo de reflexão, **When** o trace é inspecionado, **Then** ele contém eventos com `type: "critique"` registrando o feedback estruturado do avaliador antes da resposta regenerada.
2. **Given** a finalização da estratégia decorada, **When** as métricas são apuradas, **Then** `metrics.llmCalls` contabiliza tanto as invocações da estratégia base quanto as chamadas de avaliação crítica, e `metrics.latencyMs` reflete o tempo total de relógio acumulado.

---

### User Story 3 - Comparação de Estratégias Refletidas na Arena (Priority: P3)

Como mantenedor do OpsPilot, desejo executar na Arena CLI as variantes refletidas `reflect:react` e `reflect:plan-and-execute` sobre o mesmo alerta, para comparar diretamente a melhoria de acurácia contra o acréscimo de chamadas e latência gerado pela camada de reflexão.

**Why this priority**: Permite tomar decisões informadas de engenharia sobre quando o custo extra de reflexão se justifica frente à criticidade do incidente.

**Independent Test**: Pode ser testado executando `npm run arena -- --strategies react,reflect:react --max-iterations 4`, conferindo a exibição de ambas as estratégias no terminal e a tabela comparativa contendo o trace com eventos de crítica e o total de chamadas.

**Acceptance Scenarios**:

1. **Given** a flag `--strategies reflect:react,reflect:plan-and-execute`, **When** a Arena é disparada, **Then** ambas as estratégias decoradas são instanciadas, executadas e seus traces exibem eventos `[CRITIQUE]` e métricas consolidadas.
2. **Given** a passagem de aliases como `reflect-react` ou `reflect:plan-execute`, **When** o comando é interpretado, **Then** o sistema reconhece as variações e direciona para as estratégias correspondentes sem erros de parâmetro.

---

### Edge Cases

- **Aprovação na Primeira Rodada**: Quando o crítico aprova logo na primeira avaliação, nenhuma regeneração é disparada e o overhead é de apenas 1 chamada extra de avaliação.
- **Esgotamento de `maxReflections`**: Quando a resposta não atinge aprovação após atingir o limite estipulado em `opts.maxReflections` (default: 2), o loop para e a última resposta disponível é retornada, acompanhada pelo trace completo.
- **Falha de Parse ou Resposta Vazia do Crítico**: Se o crítico falhar na geração estruturada ou sofrer timeout, a camada deve tratar o erro com fallback gracioso, assumindo aprovação ou registrando a crítica sem derrubar o processo do agente.
- **Trace Inicial Vazio de Observações**: Se a estratégia base responder sem invocar nenhuma ferramenta, o crítico deve checar se a consulta exigia consulta a ferramentas e sugerir busca de dados caso necessário.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE implementar a função de ordem superior `withReflection(strategy: ReasoningStrategy, options?: ReflectionOptions): ReasoningStrategy`, capaz de decorar qualquer estratégia compatível com o contrato unificado `ReasoningStrategy`.
- **FR-002**: A camada de reflexão DEVE definir um schema de validação estruturada para o parecer do crítico (`CritiqueSchema`) contendo `approved: boolean` e `feedback: string`.
- **FR-003**: O crítico DEVE utilizar o modelo padrão gerado pela fábrica centralizada (`createModel()`), avaliando a resposta final da estratégia em contraste direto com as observações factuais (`type: "observation"`) presentes no `trace`.
- **FR-004**: Se o crítico avaliar com `approved === false`, o sistema DEVE reexecutar a estratégia base injetando a crítica e as diretrizes de correção no contexto da nova invocação.
- **FR-005**: O loop de reflexão DEVE interromper a execução quando `approved === true` ou quando a contagem de reflexões atingir o limite configurado em `options.maxReflections` (padrão estrito de `2` reflexões).
- **FR-006**: Cada avaliação do crítico DEVE ser registrada como um evento com `type: "critique"` no array `trace` retornado, contendo o veredito e os apontamentos de correção.
- **FR-007**: As métricas de execução (`metrics`) retornadas pela estratégia decorada DEVEM somar estritamente todas as chamadas de modelo da estratégia base e as chamadas efetuadas pelo crítico (`llmCalls`), bem como computar a latência total acumulada (`latencyMs`).
- **FR-008**: A CLI da Arena em `src/arena.ts` DEVE registrar e expor as opções `reflect:react` e `reflect:plan-and-execute` (incluindo variações de hífen e alias amigáveis), permitindo compará-las diretamente com as estratégias base.
- **FR-009**: O sistema DEVE conter suíte de testes unitários automatizados com `node:test` cobrindo o decorator `withReflection`, a aprovação imediata, a regeneração sob feedback, o teto de `maxReflections` e o acúmulo de métricas de forma 100% determinística e sem dependência de rede externa.

### Key Entities

- **ReflectionOptions**: Configuração da reflexão (`maxReflections?: number`, `model?: any`).
- **CritiqueResult**: Estrutura de saída do crítico contendo `approved: boolean` e `feedback: string`.
- **ReflectedStrategy**: Instância decorada de `ReasoningStrategy` com nome composto (ex.: `reflect:${strategy.name}`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das estratégias decoradas com `withReflection` retornam o contrato canônico `StrategyResult` contendo respostas validadas, eventos `critique` no trace e métricas consolidadas.
- **SC-002**: O número de ciclos de reflexão nunca excede `maxReflections` (default 2), garantindo teto previsível de custo e tempo de resposta.
- **SC-003**: As métricas `llmCalls` e `latencyMs` reportadas refletem fidedignamente o total somado de todas as iterações e chamadas do crítico, sem perdas de contagem entre regenerações.
- **SC-004**: 100% dos testes unitários da camada de reflexão rodam de forma determinística em menos de 3 segundos via `npm test`.

## Assumptions

- O crítico utiliza a mesma fábrica centralizada de modelos (`src/agents/model.ts`) e parametrização de temperatura (`0`) do restante do sistema.
- A injeção de feedback na regeneração preserva a intenção do usuário original adicionando as observações e a crítica como instruções de refinamento.
- Testes determinísticos utilizam mocks da interface `ReasoningStrategy` e do modelo crítico para simular cenários de aprovação, reprovação e contagem de chamadas sem conexão real com o OpenRouter.
