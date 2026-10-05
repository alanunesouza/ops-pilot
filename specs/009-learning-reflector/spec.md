# Feature Specification: Refletor de Aprendizado Contínuo (`009-learning-reflector`)

**Feature Branch**: `009-learning-reflector`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Refletor de aprendizado: após cada resposta, um withStructuredOutput({ hasLearning, fact }) lê a ultima mensagem do usuário e destila fatos duráveis (nunca pedido pontual, nunca segredo) -> memories.remeber assíncrono; tool forget_preference"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Destilação Estruturada e Aprendizado Automático Pós-Resposta (Priority: P1) 🎯 MVP

Como operador do OpsPilot, quero que o assistente analise minhas interações automaticamente após cada resposta e aprenda minhas preferências e fatos operacionais recorrentes, para que o sistema se adapte ao meu estilo operacional sem que eu precise pedir explicitamente "salve isso na minha memória".

**Why this priority**: É o cerne do aprendizado contínuo. Converte mensagens naturais em conhecimento destilado durável usando saídas estruturadas (`withStructuredOutput`).

**Independent Test**: Executar a função de reflexão de aprendizado passando uma mensagem com um fato durável (ex.: `"Prefiro que alertas de banco sejam escalados direto para o time de DBA"`) e verificar que o modelo retorna `{ hasLearning: true, fact: "..." }` e persiste no `MemoryStore` do usuário via `remember`.

**Acceptance Scenarios**:

1. **Given** uma mensagem do usuário contendo uma diretriz operacional durável ou preferência (ex.: "Sempre utilize mitigação por chaveamento antes de reiniciar pods"), **When** o refletor de aprendizado for acionado, **Then** o modelo extrai `{ hasLearning: true, fact: "..." }` e executa `memoryStore.remember(userId, fact)` de forma assíncrona.
2. **Given** uma interação ordinária ou sem preferências de longo prazo (ex.: "Quantos alertas temos no momento?"), **When** o refletor de aprendizado for acionado, **Then** o modelo extrai `{ hasLearning: false }` e nenhuma memória é gravada.

---

### User Story 2 - Salvaguardas de Segurança: Rejeição de Segredos e Pedidos Efêmeros (Priority: P2)

Como engenheiro de segurança e confiabilidade, quero que o refletor de aprendizado ignore estritamente pedidos pontuais/efêmeros e bloqueie terminantemente a gravação de segredos, senhas e tokens de acesso, para manter a base de conhecimento limpa e em conformidade com as políticas de segurança.

**Why this priority**: Evita poluição cognitiva com comandos passageiros e impede vazamento de credenciais e material sensível no banco vetorial SQLite.

**Independent Test**: Submeter mensagens contendo pedidos efêmeros (ex.: `"Abra um incidente para o alerta 2 agora"`) ou segredos (ex.: `"Minha chave de API é secret_12345"` ou `"A senha do banco é admin@123"`) e validar que o refletor retorna `hasLearning: false` e não persiste nada.

**Acceptance Scenarios**:

1. **Given** uma mensagem contendo pedidos operacionais passageiros (ex.: "Reinicie o pod de pagamento", "Liste os serviços firing"), **When** o refletor analisar a mensagem, **Then** classifica como não durável (`hasLearning: false`) e descarta a gravação.
2. **Given** uma mensagem contendo credenciais, tokens, API keys, senhas ou segredos, **When** o refletor analisar a mensagem, **Then** as instruções do modelo e validações determinísticas garantem que o fato não seja gravado (`hasLearning: false`).

---

### User Story 3 - Ferramenta Operacional `forget_preference` (Priority: P3)

Como operador, quero pedir à IA através da conversa que esqueça uma preferência desatualizada ou revogada, para que o modelo utilize uma ferramenta dedicada (`forget_preference`) para localizar e excluir a memória sem intervenção manual no banco.

**Why this priority**: Fecha o ciclo de governança de dados e controle pelo usuário, permitindo exclusão em linguagem natural via agent tools.

**Independent Test**: Registrar uma memória para o usuário, solicitar ao agente via chat para esquecer essa preferência e verificar que a ferramenta `forget_preference` é invocada, localiza a memória via `recall`, executa `forget(userId, memoryId)` e retorna confirmação clara.

**Acceptance Scenarios**:

1. **Given** uma preferência salva para o operador, **When** o operador disser "Esqueça que eu prefiro chaveamento de tráfego", **Then** o agente aciona a ferramenta `forget_preference(topicOrFact)`, a ferramenta encontra a memória correspondente via busca semântica, remove o registro e confirma a exclusão ao operador.
2. **Given** uma tentativa de esquecer um fato que não existe na memória do usuário, **When** `forget_preference` for chamada, **Then** retorna uma observação amigável informando que nenhuma preferência semelhante foi encontrada.

---

### User Story 4 - Integração Assíncrona no Ciclo de Vida HTTP /chat (Priority: P4)

Como cliente da API `/chat`, quero que a reflexão de aprendizado aconteça de maneira assíncrona após a resposta ao usuário, para que a latência percebida no endpoint HTTP não seja prejudicada pelo tempo de destilação.

**Why this priority**: Garante alta responsividade do chat e desacoplamento do tempo de resposta ao usuário do processamento analítico de fundo.

**Independent Test**: Fazer uma requisição a `POST /chat` contendo `userId`, receber o `200 OK` imediatamente com a resposta do agente e confirmar em background que o refletor processou a mensagem e registrou o fato no `MemoryStore`.

**Acceptance Scenarios**:

1. **Given** uma requisição `POST /chat` contendo `userId` e uma nova preferência, **When** o agente termina de gerar a resposta, **Then** a resposta HTTP é enviada sem bloqueio e o refletor executa em background (`Promise` sem `await` ou `setImmediate`), persistindo o aprendizado de forma assíncrona.
2. **Given** uma requisição sem `userId`, **When** processada, **Then** o refletor é ignorado, mantendo custo zero de LLM adicional.

---

### Edge Cases

- **Falha de LLM na reflexão**: Erros durante a chamada do refletor (timeout de LLM, falha de rede) devem ser capturados e registrados em log sem derrubar o processo principal nem propagar erro para o chat já respondido.
- **Similaridade duplicada**: Fatos destilados equivalentes a preferências já salvas serão automaticamente deduplicados pelo `SqliteMemoryStore` (> 0.92) sem erros.
- **Mensagem vazia ou sem texto**: Mensagens em branco não acionam o refletor de aprendizado.
- **Múltiplos fatos na mesma mensagem**: O schema estruturado deve destilar a essência da diretriz mais relevante ou o fato principal em formato conciso de 3ª pessoa ("O operador prefere...").

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer o schema Zod `LearningReflectionSchema` com as propriedades:
  - `hasLearning: z.boolean()`
  - `fact: z.string().optional()` (descrição clara e atemporal do fato ou preferência)
- **FR-002**: O sistema DEVE implementar a função `reflectLearning(userId: string, userMessage: string, options?: ReflectLearningOptions)` utilizando `model.withStructuredOutput(LearningReflectionSchema)` para destilar fatos duráveis.
- **FR-003**: O prompt do refletor DEVE conter regras estritas de discriminação:
  - Capturar apenas preferências permanentes de trabalho, regras operacionais e papéis ("O operador prefere...", "O operador é responsável por...").
  - NUNCA capturar pedidos efêmeros/pontuais (ex.: "veja o status agora", "reinicie a api").
  - NUNCA capturar senhas, credenciais, segredos, chaves de API, certificados ou tokens.
- **FR-004**: Quando `hasLearning` for `true` e `fact` estiver presente e válido, o sistema DEVE invocar `memoryStore.remember(userId, fact)`.
- **FR-005**: O sistema DEVE implementar a ferramenta operacional `forget_preference` (em `src/agents/tools.ts` ou `src/memory/tools.ts`), com schema Zod `{ preference: z.string() }`:
  - Executa `memoryStore.recall(userId, preference, 1)` para localizar a memória mais relevante com score $\ge 0.3$.
  - Se encontrada, executa `memoryStore.forget(userId, memoryId)` e retorna confirmação contendo o texto da preferência esquecida.
  - Se não encontrada, retorna mensagem informando que nenhuma preferência correlata foi localizada.
- **FR-006**: A ferramenta `forget_preference` DEVE ser integrada ao catálogo de ferramentas do agente (`opsTools`) e exportada para MCP e estratégias ReAct / Plan-and-Execute.
- **FR-007**: No endpoint `POST /chat` (`runChat`), após a geração da resposta do agente e quando `userId` estiver presente, o sistema DEVE disparar `reflectLearning(userId, input.message)` de forma assíncrona (não bloqueante para o cliente).

---

### Key Entities

- **LearningReflection**: Objeto estruturado `{ hasLearning: boolean, fact?: string }`.
- **LearningReflector**: Função ou serviço responsável por avaliar a mensagem e acionar o `memoryStore.remember`.
- **forget_preference**: Ferramenta executável por LLMs para busca semântica e remoção de memórias pelo operador.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos testes determinísticos com declarações claras de preferências de trabalho (ex.: "Prefiro mitigação por DNS") resultam em `hasLearning: true` e são gravados no `MemoryStore`.
- **SC-002**: 100% dos testes contendo pedidos pontuais ou credenciais/senhas resultam em descarte (`hasLearning: false`) e nenhuma inserção no banco de memórias.
- **SC-003**: A ferramenta `forget_preference` localiza e exclui com sucesso memórias pré-existentes a partir de termos em linguagem natural via `recall`.
- **SC-004**: O tempo de resposta de `POST /chat` não sofre acréscimo de latência perceptível pela reflexão em background.

---

## Assumptions

- O modelo subjacente (`ChatOpenAI` ou compatível) suporta `withStructuredOutput` via JSON Schema / Tool Calling do LangChain.
- `SqliteMemoryStore` implementado na spec 008 fornece os métodos `remember`, `recall` e `forget` necessários para persistência e exclusão.
- Contexto de `userId` está disponível para a tool `forget_preference` através de injeção contextual de runtime ou closure de execução.
