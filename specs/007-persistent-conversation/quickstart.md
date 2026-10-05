# Quickstart: Validação de Conversa Persistente (`007-persistent-conversation`)

Este guia detalha como validar ponta a ponta a persistência de conversas, a composição das últimas 12 mensagens no prompt e a métrica `historyMessages`.

---

## 1. Pré-Requisitos

- Node.js 22 LTS instalado.
- Dependências instaladas (`npm install`).

---

## 2. Validação Rápida via Testes Automatizados

Execute a suíte de testes unitários e de integração:

```bash
npm test
```

### Casos de Teste Cobertos:
1. **Unitário (`src/store/sqlite-conversation-store.test.ts`)**:
   - Criação de nova conversa com ID único.
   - Inserção (`append`) de mensagens `user` e `assistant`.
   - Recuperação das últimas $N$ mensagens (`lastMessages`) em ordem cronológica.
   - Rejeição de papéis não permitidos via constraint `CHECK`.
2. **Integração HTTP (`src/http/server.test.ts`)**:
   - Requisição sem `conversationId`: verifica geração de novo ID e `historyMessages: 0`.
   - Requisições subsequentes com o mesmo `conversationId`: verifica persistência de histórico e incremento de `historyMessages`.
   - Truncamento após 12 mensagens: garante que o prompt recebe no máximo 12 itens e `historyMessages === 12`.

---

## 3. Validação Manual via API HTTP

### 3.1. Iniciar o Servidor Localmente

```bash
npm run dev
```

### 3.2. Primeiro Turno (Criar Conversa)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá, sou o operador do plantão da noite."}'
```

**Verificação**:
- Status: `200 OK`.
- Resposta contém um `conversationId` (ex.: `"7d12f123-..."`).
- Campo `metrics.historyMessages` é igual a `0`.

### 3.3. Segundo Turno (Continuidade com o Mesmo `conversationId`)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Qual turno eu disse que operava?",
    "conversationId": "7d12f123-..."
  }'
```

**Verificação**:
- Status: `200 OK`.
- Resposta preserva o mesmo `conversationId`.
- Campo `metrics.historyMessages` é maior que 0 (ex.: `2`).
- A resposta do modelo menciona o turno da noite, comprovando a injeção do histórico no prompt.

---

## 4. Referências

- [Especificação de Requisitos (spec.md)](./spec.md)
- [Modelo de Dados (data-model.md)](./data-model.md)
- [Contrato da API HTTP (contracts/chat-api-contract.md)](./contracts/chat-api-contract.md)
- [Contrato do ConversationStore (contracts/conversation-store-contract.md)](./contracts/conversation-store-contract.md)
