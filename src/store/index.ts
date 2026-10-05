import { SqliteConversationStore } from "./sqlite-conversation-store.js";
import type { ConversationStore } from "./types.js";

let defaultConversationStore: ConversationStore | undefined;

/**
 * Obtém ou cria a instância singleton padrão do ConversationStore.
 */
export function getConversationStore(): ConversationStore {
  if (!defaultConversationStore) {
    defaultConversationStore = new SqliteConversationStore();
  }
  return defaultConversationStore;
}

/**
 * Permite sobrescrever o ConversationStore padrão (ex.: em testes ou benchmarks).
 */
export function setConversationStore(store: ConversationStore): void {
  defaultConversationStore = store;
}

export * from "./types.js";
export * from "./sqlite-ops-store.js";
export * from "./sqlite-conversation-store.js";
export * from "./memory.js";
