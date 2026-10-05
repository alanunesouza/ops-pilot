# Quickstart: Validação de Memória Semântica (`008-semantic-memory`)

Este guia demonstra como validar a gravação (`remember`), deduplicação (> 0.92), busca vetorial semântica (`recall`) e esquecimento (`forget`) no OpsPilot.

---

## 1. Validação via Testes Automatizados

Execute a suíte de testes unitários de memória:

```bash
npm test -- "src/memory/**/*.test.ts"
```

### Casos Cobertos:
1. **Deduplicação**: Gravação de duas frases semanticamente idênticas descarta a segunda e não cria duplicata.
2. **Similaridade Sem Palavras em Comum**: Gravação de `"Eu trabalho no plantão do turno noturno"` e consulta com `"A que horas eu opero o sistema?"` retorna o fato com score $\ge 0.3$.
3. **Isolamento de Usuários**: `userId: 'A'` não enxerga as memórias de `userId: 'B'`.
4. **Remoção (`forget`)**: A memória é removida e não mais retornada no `recall`.

---

## 2. Validação Manual via API HTTP

### 2.1. Execução de Chat com Identificação de Usuário

```bash
curl -s localhost:3000/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Qual é a minha preferência de remediação?",
    "userId": "usr-thiago"
  }'
```

Se houver fatos previamente gravados no `MemoryStore` para `"usr-thiago"`, eles serão automaticamente injetados no prompt da APO.
