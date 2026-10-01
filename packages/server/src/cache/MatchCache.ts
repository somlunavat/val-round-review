import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * SQLite cache of raw match payloads keyed by match id. Completed matches never
 * change, so entries are kept indefinitely.
 */
export class MatchCache {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS matches (match_id TEXT PRIMARY KEY, json TEXT NOT NULL, fetched_at INTEGER NOT NULL)",
    );
  }

  get(matchId: string): unknown {
    const row = this.db.prepare("SELECT json FROM matches WHERE match_id = ?").get(matchId);
    const json = row?.json;
    return typeof json === "string" ? (JSON.parse(json) as unknown) : undefined;
  }

  put(matchId: string, payload: unknown): void {
    this.db
      .prepare("INSERT OR REPLACE INTO matches (match_id, json, fetched_at) VALUES (?, ?, ?)")
      .run(matchId, JSON.stringify(payload), Date.now());
  }

  close(): void {
    this.db.close();
  }
}
