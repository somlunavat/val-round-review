import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MatchSchema } from "@replay-lab/shared";
import { FIXTURE_MATCHES_DIR, SELF_PUUID, fixtureSet } from "../src/index.js";

const matches = fixtureSet();

describe("fixture generator", () => {
  it("is deterministic and matches the committed files", () => {
    for (const m of matches) {
      const file = join(FIXTURE_MATCHES_DIR, `${m.matchInfo.matchId}.json`);
      const committed: unknown = JSON.parse(readFileSync(file, "utf8"));
      const fresh: unknown = JSON.parse(JSON.stringify(m));
      expect(committed, `${file} is stale; run pnpm fixtures:gen`).toEqual(fresh);
    }
  });

  it.each(matches.map((m) => [m.matchInfo.matchId, m] as const))(
    "%s passes the match schema and has 13+ rounds with 10 players",
    (_id, m) => {
      expect(MatchSchema.safeParse(m).success).toBe(true);
      expect(m.roundResults.length).toBeGreaterThanOrEqual(13);
      expect(m.players).toHaveLength(10);
    },
  );

  it("covers plants, defuses, detonations, and eliminations", () => {
    const results = new Set(matches.flatMap((m) => m.roundResults.map((r) => r.roundResult)));
    for (const r of ["Eliminated", "Bomb detonated", "Bomb defused", "Round timer expired"]) {
      expect(results).toContain(r);
    }
  });

  it("includes a match the fixture player is not in", () => {
    expect(matches.some((m) => !m.players.some((p) => p.puuid === SELF_PUUID))).toBe(true);
  });

  describe("edge-case match", () => {
    const edge = matches.find((m) => m.matchInfo.matchId.includes("edge"));
    if (!edge) throw new Error("edge-case fixture missing");
    const round = (n: number) => {
      const r = edge.roundResults[n];
      if (!r) throw new Error(`round ${n} missing`);
      return r;
    };

    it("has a round with no kills and no plant", () => {
      const r = round(3);
      expect(r.playerStats.flatMap((p) => p.kills ?? [])).toHaveLength(0);
      expect(r.bombPlanter).toBeNull();
    });

    it("has a player with missing economy", () => {
      expect(round(5).playerStats.some((p) => !p.economy)).toBe(true);
    });

    it("has kills without playerLocations", () => {
      const kills = round(7).playerStats.flatMap((p) => p.kills ?? []);
      expect(kills.length).toBeGreaterThan(0);
      expect(kills.every((k) => k.playerLocations === undefined)).toBe(true);
    });

    it("has an AFK player with no kills", () => {
      const afk = edge.roundResults.flatMap((r) => r.playerStats.filter((p) => p.wasAfk));
      expect(afk.length).toBe(edge.roundResults.length);
      expect(afk.flatMap((p) => p.kills ?? [])).toHaveLength(0);
    });
  });
});
