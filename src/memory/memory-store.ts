import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Memory, MemoryStore, RememberResult } from "./types.js";
import { embed, dot } from "./embeddings.js";

function bufferToFloat32Array(buf: Buffer): Float32Array {
  // Cria uma cópia do ArrayBuffer para garantir o alinhamento de bytes (múltiplo de 4)
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  return new Float32Array(copy);
}

function float32ArrayToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/**
 * Repositório relacional e semântico de memórias de operadores com SQLite.
 */
export class SqliteMemoryStore implements MemoryStore {
  _db: DatabaseSync;

  constructor(dbOrPath: DatabaseSync | string = process.env.OPSPILOT_DB ?? "./data/opspilot.db") {
    if (typeof dbOrPath === "string") {
      if (dbOrPath !== ":memory:") {
        const dir = path.dirname(dbOrPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
      this._db = new DatabaseSync(dbOrPath);
    } else {
      this._db = dbOrPath;
    }

    this.initDDL();
  }

  private initDDL(): void {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fact TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id);
    `);
  }

  /**
   * Recupera todas as memórias gravadas para um determinado usuário.
   */
  public _all(userId: string): Memory[] {
    const stmt = this._db.prepare(`
      SELECT 
        id, 
        user_id AS userId, 
        fact, 
        embedding, 
        created_at AS createdAt
      FROM memories
      WHERE user_id = ?
      ORDER BY rowid ASC
    `);

    const rows = stmt.all(userId) as unknown as Array<{
      id: string;
      userId: string;
      fact: string;
      embedding: Buffer;
      createdAt: string;
    }>;

    return rows.map((row) => ({
      id: String(row.id),
      userId: String(row.userId),
      fact: String(row.fact),
      embedding: bufferToFloat32Array(row.embedding),
      createdAt: String(row.createdAt),
    }));
  }

  /**
   * Armazena um fato para um operador com verificação de duplicidade semântica (> 0.92).
   */
  public async remember(userId: string, fact: string): Promise<RememberResult> {
    const cleanFact = fact.trim();
    if (!cleanFact) {
      throw new Error("O fato não pode ser vazio.");
    }

    const q = await embed(cleanFact);
    const existing = this._all(userId);

    let maxSim = -Infinity;
    let mostSimilarMemory: Memory | undefined;

    for (const mem of existing) {
      const sim = dot(q, mem.embedding);
      if (sim > maxSim) {
        maxSim = sim;
        mostSimilarMemory = mem;
      }
    }

    if (maxSim > 0.92 && mostSimilarMemory) {
      return {
        inserted: false,
        reason: "deduplicated",
        memory: mostSimilarMemory,
        similarity: maxSim,
      };
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const buf = float32ArrayToBuffer(q);

    const stmt = this._db.prepare(`
      INSERT INTO memories (id, user_id, fact, embedding, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, userId, cleanFact, buf, createdAt);

    const memory: Memory = {
      id,
      userId,
      fact: cleanFact,
      embedding: q,
      createdAt,
    };

    return {
      inserted: true,
      reason: "created",
      memory,
    };
  }

  /**
   * Recupera as memórias mais relevantes para a consulta com relevância mínima de 0.3.
   */
  public async recall(userId: string, query: string, k: number = 3): Promise<Memory[]> {
    const q = await embed(query);

    return this._all(userId)
      .map((mappedUser) => ({ ...mappedUser, score: dot(q, mappedUser.embedding) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, k)
      .filter((mappedUser) => (mappedUser.score ?? 0) >= 0.3); // relevância mínima
  }

  /**
   * Remove uma memória associada ao operador.
   */
  public async forget(userId: string, memoryId: string): Promise<boolean> {
    const stmt = this._db.prepare(`
      DELETE FROM memories
      WHERE user_id = ? AND id = ?
    `);

    const result = stmt.run(userId, memoryId);
    return Number(result.changes) > 0;
  }
}
