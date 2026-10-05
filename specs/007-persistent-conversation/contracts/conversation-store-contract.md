# Contract: `ConversationStore` Interface

Este contrato define a interface abstrata de persistência de conversas e mensagens no OpsPilot.

---

## 1. Definição da Interface TypeScript

```typescript
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ConversationStore {
  /**
   * Aloca ou gera um novo identificador de conversa único.
   * @returns Identificador único da nova conversa (UUID v4).
   */
  create(): string;

  /**
   * Registra uma nova mensagem vinculada a uma conversa existente.
   * @param conversationId Identificador da conversa
   * @param role Papel do emissor da mensagem
   * @param content Texto integral da mensagem
   * @returns Entidade da mensagem persistida com id e timestamp
   */
  append(
    conversationId: string,
    role: "user" | "assistant" | "system",
    content: string
  ): ConversationMessage;

  /**
   * Recupera as últimas mensagens de uma conversa ordenadas cronologicamente.
   * @param conversationId Identificador da conversa
   * @param limit Quantidade máxima de mensagens a recuperar (padrão: 12)
   * @returns Lista de mensagens ordenadas da mais antiga para a mais recente
   */
  lastMessages(conversationId: string, limit?: number): ConversationMessage[];
}
```

---

## 2. Comportamento e Invariantes

1. **Idempotência e DDL**: O store deve inicializar a tabela `messages` e seus índices com comandos idempotentes (`CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`) no construtor.
2. **Prepared Statements**: Todas as operações SQL em implementações SQLite devem utilizar consultas parametrizadas.
3. **Ordem de Retorno em `lastMessages`**: Mesmo buscando os últimos $N$ registros com base no timestamp/id mais recente, a coleção retornada deve ser ordenada em ordem cronológica ascendente (`ASC`) para que os turnos do diálogo sejam apresentados na sequência correta.
4. **Isolamento**: O construtor deve aceitar `:memory:` ou uma instância `DatabaseSync` existente para viabilizar testes sem escrita em disco.
