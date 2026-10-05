# Contract: Tool `forget_preference`

Este contrato documenta a especificação da ferramenta operacional de esquecimento de preferências por operadores.

---

## Metadados da Tool

- **Nome**: `forget_preference`
- **Descrição**: "Remove ou revoga uma preferência ou fato durável previamente aprendido sobre o operador logado."
- **Schema de Entrada**:
  ```typescript
  z.object({
    preference: z
      .string()
      .trim()
      .min(1)
      .describe("Descrição em linguagem natural ou palavra-chave da preferência que o operador deseja esquecer."),
  });
  ```

---

## Comportamento

1. Executa busca vetorial semântica usando `memoryStore.recall(userId, preference, 1)`.
2. Se nenhuma memória retornar pontuação $\ge 0.3$:
   - Retorna mensagem amigável: `"Nenhuma preferência correspondente a '${preference}' foi encontrada para exclusão."`
3. Se uma memória for encontrada:
   - Executa `memoryStore.forget(userId, memory.id)`.
   - Retorna mensagem de sucesso: `"A preferência '${memory.fact}' foi removida com sucesso da sua memória."`
