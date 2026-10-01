import { describe, expect, it } from "vitest";
import { MatchReplaySchema, type Kill, type Match, type RoundResult } from "@replay-lab/shared";
import { fixtureSet, SELF_PUUID } from "@replay-lab/fixtures";
import {
  NotParticipantError,
  ROUND_TIMER_MS,
  SPIKE_FUSE_MS,
  toMatchReplay,
  toMatchSummary,
} from "../src/transform/toReplay.js";

const loc = (x: number, y: number) => ({ x, y });

function kill(t: number, killer: string, victim: string, extra: Partial<Kill> = {}): Kill {
  return {
    timeSinceGameStartMillis: 1_000_000 + t,
    timeSinceRoundStartMillis: t,
    killer,
    victim,
    victimLocation: loc(t, -t),
    ...extra,
  };
}

function round(partial: Partial<RoundResult> & Pick<RoundResult, "roundNum">): RoundResult {
  return {
    roundResult: "Eliminated",
    winningTeam: "Blue",
    playerStats: [],
    ...partial,
  };
}

function match(rounds: RoundResult[]): Match {
  return {
    matchInfo: {
      matchId: "m1",
      mapId: "/Game/Maps/Ascent/Ascent",
      gameStartMillis: 5,
      isCompleted: true,
    },
    players: [
      {
        puuid: "me",
        teamId: "Blue",
        characterId: "agent-1",
        gameName: "Me",
        tagLine: "1",
        stats: { score: 300, roundsPlayed: 2, kills: 3, deaths: 1, assists: 2 },
      },
      { puuid: "ally", teamId: "Blue" },
      { puuid: "foe1", teamId: "Red", gameName: "Secret", tagLine: "X" },
      { puuid: "foe2", teamId: "Red" },
    ],
    teams: [
      { teamId: "Blue", won: true, roundsPlayed: rounds.length, roundsWon: 1 },
      { teamId: "Red", won: false, roundsPlayed: rounds.length, roundsWon: 0 },
    ],
    roundResults: rounds,
  };
}

describe("toMatchReplay", () => {
  it("refuses matches the player was not in", () => {
    expect(() => toMatchReplay(match([]), "stranger")).toThrow(NotParticipantError);
  });

  it("never exposes player names", () => {
    const json = JSON.stringify(toMatchReplay(match([round({ roundNum: 0 })]), "me"));
    expect(json).not.toContain("Secret");
    expect(json).not.toContain("gameName");
  });

  it("builds kill events and snapshots in time order with alive flags", () => {
    const r = round({
      roundNum: 0,
      playerStats: [
        {
          puuid: "me",
          kills: [
            kill(30_000, "me", "foe2", {
              playerLocations: [
                { puuid: "me", viewRadians: 1.5, location: loc(1, 1) },
                { puuid: "foe2", location: loc(9, 9) },
              ],
              finishingDamage: { damageType: "Weapon", damageItem: "vandal" },
            }),
          ],
        },
        {
          puuid: "foe1",
          kills: [
            kill(10_000, "foe1", "ally", {
              playerLocations: [
                { puuid: "me", location: loc(2, 2) },
                { puuid: "ally", location: loc(3, 3) },
                { puuid: "foe1", location: loc(4, 4) },
              ],
            }),
          ],
        },
      ],
    });
    const [replayRound] = toMatchReplay(match([r]), "me").rounds;
    expect(replayRound?.events.map((e) => e.t)).toEqual([10_000, 30_000]);
    expect(replayRound?.events[1]).toEqual({
      type: "kill",
      t: 30_000,
      killer: "me",
      victim: "foe2",
      weapon: "vandal",
      victimPos: loc(30_000, -30_000),
    });

    const [first, second] = replayRound?.snapshots ?? [];
    // Victim is placed at victimLocation (not the listed location) and marked dead.
    expect(first?.players.find((p) => p.puuid === "ally")).toEqual({
      puuid: "ally",
      team: "Blue",
      pos: loc(10_000, -10_000),
      alive: false,
    });
    expect(second?.players.find((p) => p.puuid === "me")).toMatchObject({
      facing: 1.5,
      alive: true,
    });
    expect(second?.players.find((p) => p.puuid === "foe2")).toMatchObject({
      pos: loc(30_000, -30_000),
      alive: false,
    });
  });

  it("keeps the victim in a snapshot when playerLocations is missing", () => {
    const r = round({
      roundNum: 0,
      playerStats: [{ puuid: "me", kills: [kill(5_000, "me", "foe1")] }],
    });
    const snap = toMatchReplay(match([r]), "me").rounds[0]?.snapshots[0];
    expect(snap?.players).toEqual([
      { puuid: "foe1", team: "Red", pos: loc(5_000, -5_000), alive: false },
    ]);
  });

  it("handles a kill with no killer", () => {
    const k = kill(5_000, "x", "foe1");
    delete k.killer;
    const r = round({ roundNum: 0, playerStats: [{ puuid: "me", kills: [k] }] });
    expect(toMatchReplay(match([r]), "me").rounds[0]?.events[0]).not.toHaveProperty("killer");
  });

  it("adds plant and defuse events and snapshots", () => {
    const r = round({
      roundNum: 0,
      roundResult: "Bomb defused",
      bombPlanter: "foe1",
      plantRoundTime: 40_000,
      plantSite: "A",
      plantLocation: loc(7, 7),
      plantPlayerLocations: [{ puuid: "foe1", location: loc(5, 5) }],
      bombDefuser: "me",
      defuseRoundTime: 70_000,
      defusePlayerLocations: [{ puuid: "me", location: loc(6, 6) }],
      playerStats: [{ puuid: "me", kills: [kill(60_000, "me", "foe1")] }],
    });
    const rr = toMatchReplay(match([r]), "me").rounds[0];
    expect(rr?.events.map((e) => e.type)).toEqual(["plant", "kill", "defuse"]);
    expect(rr?.events[0]).toEqual({
      type: "plant",
      t: 40_000,
      planter: "foe1",
      site: "A",
      pos: loc(7, 7),
    });
    expect(rr?.snapshots.map((s) => s.source)).toEqual(["plant", "kill", "defuse"]);
    expect(rr?.durationMs).toBe(70_000);
  });

  it("treats an empty planter and zero plant time as no plant", () => {
    const r = round({ roundNum: 0, bombPlanter: null, plantRoundTime: 0, plantSite: "" });
    const rr = toMatchReplay(match([r]), "me").rounds[0];
    expect(rr?.events).toEqual([]);
    expect(rr?.snapshots).toEqual([]);
  });

  it("derives duration from the fuse on detonation and the timer on expiry", () => {
    const det = round({
      roundNum: 0,
      roundResult: "Bomb detonated",
      bombPlanter: "foe1",
      plantRoundTime: 50_000,
    });
    const timer = round({ roundNum: 1, roundResult: "Round timer expired" });
    const [a, b] = toMatchReplay(match([det, timer]), "me").rounds;
    expect(a?.durationMs).toBe(50_000 + SPIKE_FUSE_MS);
    expect(b?.durationMs).toBe(ROUND_TIMER_MS);
  });

  it("skips missing economy and reports AFK players", () => {
    const r = round({
      roundNum: 0,
      playerStats: [
        {
          puuid: "me",
          economy: { loadoutValue: 3900, spent: 3900, remaining: 100, weapon: "vandal" },
        },
        { puuid: "foe2", wasAfk: true },
      ],
    });
    const rr = toMatchReplay(match([r]), "me").rounds[0];
    expect(rr?.economy).toEqual([
      { puuid: "me", loadoutValue: 3900, spent: 3900, remaining: 100, weapon: "vandal" },
    ]);
    expect(rr?.afk).toEqual(["foe2"]);
  });
});

describe("toMatchSummary", () => {
  it("summarises from the player's side", () => {
    const s = toMatchSummary(
      match([round({ roundNum: 0 }), round({ roundNum: 1, winningTeam: "Red" })]),
      "me",
    );
    expect(s).toMatchObject({
      selfTeam: "Blue",
      selfCharacterId: "agent-1",
      selfStats: { kills: 3, deaths: 1, assists: 2, score: 300 },
      roundsWon: 1,
      roundsLost: 1,
      won: true,
    });
  });
});

describe("fixtures", () => {
  const own = fixtureSet().filter((m) => m.players.some((p) => p.puuid === SELF_PUUID));

  it.each(own.map((m) => [m.matchInfo.matchId, m] as const))(
    "%s transforms into a valid replay",
    (_id, m) => {
      const replay = MatchReplaySchema.parse(toMatchReplay(m, SELF_PUUID));
      expect(replay.rounds).toHaveLength(m.roundResults.length);
      for (const r of replay.rounds) {
        const kills = r.events.filter((e) => e.type === "kill");
        // Every kill yields exactly one snapshot, plus one per plant/defuse with locations.
        expect(r.snapshots.filter((s) => s.source === "kill")).toHaveLength(kills.length);
        const times = r.snapshots.map((s) => s.t);
        expect(times).toEqual([...times].sort((a, b) => a - b));
        expect(r.durationMs).toBeGreaterThanOrEqual(r.events.at(-1)?.t ?? 0);
      }
    },
  );
});
