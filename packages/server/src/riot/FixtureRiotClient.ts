import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MatchSchema, type Match, type Matchlist } from "@replay-lab/shared";
import type { RiotClient } from "./RiotClient.js";

/**
 * Serves matches from local JSON files. No network, no key.
 * Development only: must be hard-gated once the live client exists.
 */
export class FixtureRiotClient implements RiotClient {
  private matches: Map<string, Match> | undefined;

  constructor(private readonly dir: string) {}

  private load(): Map<string, Match> {
    if (!this.matches) {
      this.matches = new Map();
      for (const file of readdirSync(this.dir)
        .filter((f) => f.endsWith(".json"))
        .sort()) {
        const raw: unknown = JSON.parse(readFileSync(join(this.dir, file), "utf8"));
        // Same boundary validation the live client will apply.
        const match = MatchSchema.parse(raw);
        this.matches.set(match.matchInfo.matchId, match);
      }
    }
    return this.matches;
  }

  async getMatch(matchId: string): Promise<Match | undefined> {
    return this.load().get(matchId);
  }

  async getMatchlist(puuid: string): Promise<Matchlist> {
    const history = [...this.load().values()]
      .filter((m) => m.players.some((p) => p.puuid === puuid))
      .map((m) => ({
        matchId: m.matchInfo.matchId,
        gameStartTimeMillis: m.matchInfo.gameStartMillis,
        ...(m.matchInfo.queueId ? { queueId: m.matchInfo.queueId } : {}),
      }));
    return { puuid, history };
  }
}
