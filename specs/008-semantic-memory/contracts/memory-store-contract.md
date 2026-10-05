# Contract: `MemoryStore` Interface

Este contrato define a interface abstrata de persistência e recuperação vetorial de memórias por usuário.

---

## 1. Definição da Interface TypeScript

```typescript
export interface MemoryRecord {
  id: string;
  userId: string;
  fact: string;
  embedding: Float32Array;
  createdAt: string;
}

export interface RememberResult {
  inserted: boolean;
  reason?: "created" | "deduplicated";
  memory: MemoryRecord;
  similarity?: number;
}

export interface RecallResult {
  id: string;
  fact: string;
  similarity: number;
}

export interface MemoryStore {
  /**
   * Armazena um fato em linguagem natural para um usuário com deduplicação semântica.
   * Se a similaridade com um fato existente for > 0.92, descarta a inserção redundante.
   * 
   * @param userId Identificador do operador
   * @param fact Texto do fato ou preferência
   * @returns Resultado indicando se foi inserido ou deduplicado
   */
  remember(userId: string, fact: string): Promise<RememberResult>;

  /**
   * Recupera os fatos mais relevantes para uma consulta com pontuação mínima de 0.3.
   * 
   * @param userId Identificador do operador
   * @param query Pergunta ou contexto em linguagem natural
   * @param limit Quantidade máxima de fatos a retornar (padrão: 3)
   * @returns Lista ordenada decrescentemente por similaridade
   */
  recall(userId: string, query: string, limit?: number): Promise<RecallResult[]>;

  /**
   * Remove uma memória específica associada ao usuário.
   * 
   * @param userId Identificador do operador
   * @param memoryId Identificador da memória
   * @returns true se a memória foi removida, false se não encontrada
   */
  forget(userId: string, memoryId: string): Promise<boolean>;
}
```

---

## 2. Invariantes de Comportamento

1. **Similaridade de Cosseno**: Como os embeddings são normalizados ($\|\mathbf{v}\| = 1$), a similaridade é dada pelo produto escalar $\mathbf{u} \cdot \mathbf{v}$.
2. **Deduplicação Estrita**: Qualquer entrada com similaridade estritamente superior a `0.92` em relação a qualquer memória prévia do mesmo `userId` deve ser rejeitada para gravação.
3. **Piso de Relevância**: Resultados com similaridade inferior a `0.3` devem ser sumariamente descartados no `recall`.
4. **Isolamento Multi-tenant**: Operações de um `userId` nunca devem acessar, calcular similaridade ou remover registros pertencentes a outro `userId`.
