# Research: API HTTP para Interação de Chat Operacional (`POST /chat`)

**Feature**: `003-http-chat-api`  
**Date**: 2026-09-08  
**Spec**: [spec.md](./spec.md)

---

## 1. Arquitetura do Servidor HTTP (Express v5)

### Contexto
O OpsPilot já possui Express v5 instalado (`"express": "^5.2.1"`). Precisamos expor a rota `POST /chat` de forma modular, segura, desacoplada e facilmente testável sem subir servidor de produção ou portas fixas.

### Decisão
- Dividir a camada HTTP em:
  - `src/http/app.ts`: Exporta a fábrica `createApp()` que monta os middlewares padrões (`express.json()`), roteadores e handlers de erro.
  - `src/http/server.ts`: Inicializa o servidor ouvindo na porta configurada via `PORT` (default: 3000).
- Handlers assíncronos no Express v5 tratam automaticamente Promises rejeitadas sem necessidade de wrappers externos como `express-async-errors`.
- Suporte a injeção opcional de dependências em `createApp({ registry, timeoutMs })` para permitir que testes automatizados usem instâncias isoladas sem poluir o ambiente global.

### Alternativas Consideradas
- **Arquivo único com `listen` no mesmo módulo**: Rejeitado porque impede importar o app Express em testes de integração sem disparar abertura de portas e concorrência de portas entre suites de teste.
- **Framework alternativo (Fastify / NestJS)**: Rejeitado pela Constituição do projeto, que define Express v5 como a stack obrigatória.

---

## 2. Validação na Fronteira com Zod (`ChatRequestSchema`)

### Contexto
A Constituição (Princípio II - Validação na Fronteira) exige que toda entrada HTTP externa seja validada com Zod v4 antes de atingir as camadas de domínio ou os agentes.

### Decisão
- Criar `src/schemas/chat.ts`:
  ```typescript
  export const ChatRequestSchema = z.object({
    message: z.string().trim().min(1, "A mensagem não pode ser vazia"),
    strategy: z.string().trim().default("react"),
    reflect: z.boolean().default(false),
  });
  export type ChatRequest = z.infer<typeof ChatRequestSchema>;
  ```
- Se a validação falhar: o controller ou middleware intercepta e retorna HTTP `400 Bad Request` no formato:
  ```json
  {
    "error": "Bad Request",
    "message": "Parâmetros da requisição inválidos",
    "issues": [...]
  }
  ```

---

## 3. Catálogo de Estratégias (`StrategyRegistry`) em `src/agents/index.ts`

### Contexto
O usuário solicitou: `Registry em src/agents/index.ts (nome> estratégia; reflect aplica withReflection)`. As estratégias devem ser resolvidas pelo nome, aceitando `react`, `plan-and-execute` e aliases, e se a flag `reflect` for verdadeira, a estratégia deve ser decorada dinamicamente via `withReflection(baseStrategy)`.

### Decisão
- Criar e exportar o catálogo em `src/agents/index.ts`:
  - `defaultStrategies`: mapa padrão com as instâncias `react` e `plan-and-execute`.
  - Classe / Objeto `StrategyRegistry` com métodos:
    - `get(name: string, options?: { reflect?: boolean }): ReasoningStrategy | undefined`
    - `register(name: string, strategy: ReasoningStrategy): void`
    - `list(): string[]`
- Se `name` for omitido: assume `"react"`.
- Se `reflect === true`: retorna `withReflection(strategy)`.
- Se a estratégia informada não existir no catálogo: o controller responde com HTTP `422 Unprocessable Entity`:
  ```json
  {
    "error": "Unprocessable Entity",
    "message": "Estratégia desconhecida: 'xyz'. Estratégias disponíveis: react, plan-and-execute"
  }
  ```

---

## 4. Gerenciamento de Timeout Operacional (180s -> 504)

### Contexto
Modelos de linguagem e múltiplos ciclos de reflexão podem levar de segundos a minutos. Se uma chamada congelar ou o provedor falhar sem responder, a conexão não pode ficar presa indefinidamente. O teto definido pelo operador é de 180 segundos.

### Decisão
- Implementar controle de timeout no processamento do chat com `Promise.race`:
  - Uma Promise para a execução da estratégia: `strategy.run(message)`.
  - Uma Promise temporizadora que rejeita com uma classe de erro de domínio `GatewayTimeoutError` após `timeoutMs` (padrão: 180.000 ms, ou configurado via env `CHAT_TIMEOUT_MS`).
- Ao estourar o tempo: o middleware de erro traduz para HTTP `504 Gateway Timeout`:
  ```json
  {
    "error": "Gateway Timeout",
    "message": "A execução da estratégia excedeu o tempo limite de 180 segundos."
  }
  ```
- O parâmetro `timeoutMs` é configurável na fábrica `createApp({ timeoutMs })`, permitindo que testes de integração testem o status `504` em menos de 50 milissegundos sem esperar 3 minutos reais.

---

## 5. Estratégia Fake Determinística para Testes de Integração (Sem Rede)

### Contexto
O Princípio IV da Constituição e o requisito do usuário exigem: `Teste de integração com estrategia fake deterministica, sem rede`. Os testes devem ser rápidos (< 3s), repetíveis e rodar offline sem dependência da chave de API do OpenRouter.

### Decisão
- Implementar uma classe auxiliar `FakeReasoningStrategy implements ReasoningStrategy`:
  - `name: "fake"`
  - Permite configurar respostas programadas, traces simulados e simulação de atraso (*delay*).
  - Permite testar sucesso (`200`), reflexão com `withReflection`, erros de execução e timeouts (`504`).
- Nos testes (`src/http/server.test.ts`), criar o app com um `StrategyRegistry` populado com a estratégia fake e executar requisições HTTP reais usando `fetch` nativo do Node.js 22 LTS apontando para a porta efêmera do servidor.
