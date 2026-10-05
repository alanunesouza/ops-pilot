export interface MemoryRecord {
  id: string;
  userId: string;
  fact: string;
  embedding: Float32Array;
  createdAt: string;
  score?: number;
}

export type Memory = MemoryRecord;

export interface RememberResult {
  inserted: boolean;
  reason?: "created" | "deduplicated";
  memory: MemoryRecord;
  similarity?: number;
}

export interface RecallResult {
  id: string;
  userId: string;
  fact: string;
  similarity: number;
  createdAt?: string;
}

export interface MemoryStore {
  /**
   * Armazena um fato para um operador com deduplicação semântica (> 0.92).
   */
  remember(userId: string, fact: string): Promise<RememberResult>;

  /**
   * Recupera os top-k fatos mais relevantes para uma consulta (score >= 0.3).
   */
  recall(userId: string, query: string, limit?: number): Promise<Memory[]>;

  /**
   * Remove uma memória pelo ID pertencente ao operador.
   */
  forget(userId: string, memoryId: string): Promise<boolean>;
}
