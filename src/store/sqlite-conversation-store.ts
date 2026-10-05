import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ConversationStore, ConversationMessage, MessageRole } from "./types.js";

/**
 * Repositório relacional durável de mensagens e conversas com SQLite.
 */
export class SqliteConversationStore implements ConversationStore {
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
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
      ON messages (conversation_id, created_at ASC);
    `);
  }

  public create(): string {
    return crypto.randomUUID();
  }

  public append(
    conversationId: string,
    role: MessageRole,
    content: string
  ): ConversationMessage {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const stmt = this._db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, conversationId, role, content, createdAt);

    return {
      id,
      conversationId,
      role,
      content,
      createdAt,
    };
  }

  public lastMessages(conversationId: string, limit: number = 12): ConversationMessage[] {
    const effectiveLimit = Math.max(1, limit);

    const stmt = this._db.prepare(`
      SELECT 
        id, 
        conversation_id AS conversationId, 
        role, 
        content, 
        created_at AS createdAt
      FROM (
        SELECT rowid, id, conversation_id, role, content, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY rowid DESC
        LIMIT ?
      )
      ORDER BY rowid ASC
    `);

    const rows = stmt.all(conversationId, effectiveLimit) as unknown as Array<{
      id: string;
      conversationId: string;
      role: MessageRole;
      content: string;
      createdAt: string;
    }>;

    return rows.map((row) => ({
      id: String(row.id),
      conversationId: String(row.conversationId),
      role: row.role,
      content: String(row.content),
      createdAt: String(row.createdAt),
    }));
  }
}
