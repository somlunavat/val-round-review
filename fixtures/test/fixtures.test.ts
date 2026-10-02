import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MatchSchema, lineOfSight, mapData, type Match } from "@replay-lab/shared";
import { FIXTURE_MATCHES_DIR, SELF_PUUID, cachedMasks, fixtureSet } from "../src/index.js";

// Property checks run on the committed files, which is what the app serves.
const matches: Match[] = readdirSync(FIXTURE_MATCHES_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => MatchSchema.parse(JSON.parse(readFileSync(join(FIXTURE_MATCHES_DIR, f), "utf8"))));

// Minimap masks are fetched by `pnpm fixtures:gen` and cached outside git. Without
// them (e.g. in CI) the generator can't reproduce the sight-line checks.
const masks = cachedMasks();

describe("fixture generator", () => {
  it.skipIf(!masks)("is deterministic and matches the committed files", () => {
    for (const m of fixtureSet(masks)) {
      const file = join(FIXTURE_MATCHES_DIR, `${m.matchInfo.matchId}.json`);
      const committed: unknown = JSON.parse(readFileSync(file, "utf8"));
      const fresh: unknown = JSON.parse(JSON.stringify(m));
      expect(committed, `${file} is stale; run pnpm fixtures:gen`).toEqual(fresh);
    }
  });

  it.skipIf(!masks)("only has kills with a clear sight line on the map footprint", () => {
    for (const m of matches) {
      const map = mapData(m.matchInfo.mapId);
      const mask = masks?.get(m.matchInfo.mapId);
      if (!map || !mask) continue;
      for (const r of m.roundResults) {
        for (const k of r.playerStats.flatMap((p) => p.kills ?? [])) {
          const killer = k.playerLocations?.find((p) => p.puuid === k.killer)?.location;
          if (!killer) continue;
          expect(
            lineOfSight(mask, map, killer, k.victimLocation),
            `${m.matchInfo.matchId} round ${r.roundNum} at ${k.timeSinceRoundStartMillis}`,
          ).toBe(true);
        }
      }
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

  it("only has kills between players within engagement range", () => {
    for (const m of matches) {
      for (const r of m.roundResults) {
        for (const k of r.playerStats.flatMap((p) => p.kills ?? [])) {
          const killer = k.playerLocations?.find((p) => p.puuid === k.killer)?.location;
          if (!killer) continue;
          const d = Math.hypot(killer.x - k.victimLocation.x, killer.y - k.victimLocation.y);
          // 2200 engagement range plus position jitter.
          expect(d, `${m.matchInfo.matchId} round ${r.roundNum}`).toBeLessThan(2500);
        }
      }
    }
  });

  it("plants the spike near a site", () => {
    for (const m of matches) {
      const map = mapData(m.matchInfo.mapId);
      if (!map) throw new Error(`no map data for ${m.matchInfo.mapId}`);
      const sites = map.callouts.filter((c) => c.name === "Site");
      for (const r of m.roundResults.filter((x) => x.bombPlanter)) {
        const at = r.plantLocation;
        if (!at) continue;
        const nearest = Math.min(...sites.map((c) => Math.hypot(c.pos.x - at.x, c.pos.y - at.y)));
        expect(nearest).toBeLessThan(800);
      }
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
