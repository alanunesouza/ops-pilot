# Research & Architecture Decisions: Refletor de Aprendizado Contínuo (`009-learning-reflector`)

Este documento consolida as decisões técnicas, avaliações arquiteturais e escolhas de design para a implementação do refletor de aprendizado contínuo pós-resposta e da ferramenta de revogação de preferências.

---

## 1. Extração Estruturada via `withStructuredOutput`

### Contexto
O requisito exige que, após cada resposta do assistente, um modelo analise a última mensagem do usuário e destile fatos duráveis estruturados no formato `{ hasLearning, fact }`.

### Alternativas Consideradas

1. **Parser de texto livre com regex ou markdown fencing**:
   - *Desvantagens*: Propenso a falhas de formatação ("hallucinations" sintáticas), requer tratamento de blocos JSON malformados.
2. **LangChain `withStructuredOutput` com Zod Schema (Escolha Adotada)**:
   - *Vantagens*: Utiliza nativamente a funcionalidade de Tool Calling / JSON Mode da API (OpenAI / OpenRouter). Retorna objeto JavaScript já tipado e validado pelo Zod.
   - *Schema*:
     ```typescript
     export const LearningReflectionSchema = z.object({
       hasLearning: z.boolean().describe("Indica se a mensagem expressa uma preferência durável, regra operacional ou papel permanente do operador."),
       fact: z.string().optional().describe("Fato durável formulado em terceira pessoa (ex: 'O operador prefere...'), omitindo segredos ou pedidos efêmeros.")
     });
     ```

---

## 2. Salvaguardas: Rejeição de Segredos e Pedidos Pontuais

### Contexto
O refletor não pode, sob hipótese alguma, gravar pedidos temporários (ex: "abra um incidente para o alerta firing agora") nem senhas, API keys ou tokens.

### Estratégia de Defesa em Profundidade

1. **Prompt do Refletor (Camada Cognitiva)**:
   - Instruções imperativas com listas explícitas de "NUNCA GRAVAR":
     - Comandos imperativos imediatos ("reinicie o serviço", "liste alertas", "resolva o incidente").
     - Credenciais e segredos ("senha é...", "token:", "bearer ...", "jwt", "api_key").
   - Critérios de "GRAVAR":
     - Preferências duráveis ("eu prefiro rota X", "costumo atuar na equipe Y").
     - Regras de conduta permanente ("em lentidão, sempre chavear antes de reiniciar").
2. **Validação Heurística / Guardrail Pré-Persistência (Camada Determinística)**:
   - Regex de saneamento para barrar padrões óbvios de segredos (`/password|secret|bearer|token|apikey|api_key|senha/i`) caso o modelo tente registrar algo suspeito.
   - Rejeição de fatos excessivamente curtos ou vazios.

---

## 3. Execução Assíncrona no Ciclo de Vida do HTTP `/chat`

### Contexto
O refletor analisa a mensagem após a geração da resposta ao usuário. Executar essa chamada de LLM de forma síncrona adicionaria latência desnecessária à resposta de `POST /chat`.

### Mecanismo de Execução Não Bloqueante

- Após obter `result = await strategy.run(...)` e gravar a resposta do assistente no `conversations`, o `runChat` dispara a promessa de reflexão de aprendizado:
  ```typescript
  if (input.userId) {
    reflectLearning(input.userId, input.message, { memoryStore })
      .catch((err) => console.error("[LearningReflector] Falha assíncrona ao refletir aprendizado:", err));
  }
  ```
- O endpoint retorna `200 OK` para o cliente imediatamente.
- O processamento em background executa a extração estruturada e, se houver aprendizado, chama `memoryStore.remember(userId, fact)`.

---

## 4. Ferramenta Operacional `forget_preference`

### Contexto
O operador deve poder solicitar em linguagem natural que uma preferência seja removida (ex.: "Esqueça que eu prefiro chaveamento de tráfego").

### Mecanismo da Tool

- Nome: `forget_preference`
- Descrição: "Remove ou revoga uma preferência ou fato durável previamente aprendido sobre o operador logado."
- Parâmetro: `{ preference: z.string().describe("Descrição em linguagem natural ou palavra-chave da preferência que o operador deseja esquecer.") }`
- Fluxo de Execução:
  1. A tool obtém o `userId` ativo do contexto.
  2. Executa `memoryStore.recall(userId, input.preference, 1)`.
  3. Se nenhum fato tiver score $\ge 0.3$, retorna mensagem: `"Nenhuma preferência correspondente a '${input.preference}' foi encontrada para exclusão."`
  4. Se encontrado, executa `memoryStore.forget(userId, memory.id)` e retorna: `"A preferência '${memory.fact}' foi removida com sucesso da sua memória."`
