import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { StratSchema, type Strat, type StratSummary } from "@replay-lab/shared";

/** SQLite store for strategy boards, scoped by owner (the signed-in player's puuid). */
export class StratStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS strats (
        owner TEXT NOT NULL,
        id TEXT NOT NULL,
        json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (owner, id)
      )`,
    );
  }

  list(owner: string): StratSummary[] {
    const rows = this.db
      .prepare("SELECT json FROM strats WHERE owner = ? ORDER BY updated_at DESC")
      .all(owner);
    return rows.flatMap((row) => {
      const parsed = StratSchema.safeParse(JSON.parse(String(row.json)));
      if (!parsed.success) return [];
      const { id, title, mapPath, side, updatedAt } = parsed.data;
      return [{ id, title, mapPath, side, updatedAt }];
    });
  }

  get(owner: string, id: string): Strat | undefined {
    const row = this.db
      .prepare("SELECT json FROM strats WHERE owner = ? AND id = ?")
      .get(owner, id);
    if (!row) return undefined;
    const parsed = StratSchema.safeParse(JSON.parse(String(row.json)));
    return parsed.success ? parsed.data : undefined;
  }

  put(owner: string, strat: Strat): void {
    this.db
      .prepare("INSERT OR REPLACE INTO strats (owner, id, json, updated_at) VALUES (?, ?, ?, ?)")
      .run(owner, strat.id, JSON.stringify(strat), strat.updatedAt);
  }

  delete(owner: string, id: string): boolean {
    const res = this.db.prepare("DELETE FROM strats WHERE owner = ? AND id = ?").run(owner, id);
    return Number(res.changes) > 0;
  }
}
