import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { memoryStore, InMemoryStore } from "../store/memory.js";
import type { OpsStore } from "../store/types.js";

export const sqliteStore = new SqliteOpsStore();

let activeStore: OpsStore = sqliteStore;

export function setOpsStore(newStore: OpsStore): void {
  activeStore = newStore;
}

export function getOpsStore(): OpsStore {
  return activeStore;
}

export const store: OpsStore = new Proxy({} as OpsStore, {
  get(_target, prop) {
    const val = (activeStore as any)[prop];
    if (typeof val === "function") {
      return val.bind(activeStore);
    }
    return val;
  },
});

export { memoryStore, InMemoryStore, SqliteOpsStore };
