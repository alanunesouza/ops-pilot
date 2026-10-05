import { SqliteMemoryStore } from "./memory-store.js";
import type { MemoryStore } from "./types.js";

let defaultMemoryStore: MemoryStore | undefined;

/**
 * Obtém ou cria a instância singleton padrão do MemoryStore.
 */
export function getMemoryStore(dbPath?: string): MemoryStore {
  if (!defaultMemoryStore) {
    defaultMemoryStore = new SqliteMemoryStore(dbPath);
  }
  return defaultMemoryStore;
}

/**
 * Permite sobrescrever o MemoryStore padrão (ex.: em testes ou benchmarks).
 */
export function setMemoryStore(store: MemoryStore | undefined): void {
  defaultMemoryStore = store;
}

export * from "./types.js";
export * from "./embeddings.js";
export * from "./memory-store.js";
export * from "./reflector.js";
