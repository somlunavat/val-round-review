import { describe, expect, it } from "vitest";
import type { MatchReplay, RoundReplay } from "@replay-lab/shared";
import {
  formatRoundTime,
  killsAtSnapshot,
  plantAt,
  playerLabels,
  snapshotAt,
  timelineEnd,
} from "../src/replay/select.js";

const round: RoundReplay = {
  roundNum: 0,
  winningTeam: "Blue",
  resultType: "Bomb defused",
  durationMs: 70_000,
  economy: [],
  afk: [],
  events: [
    { type: "kill", t: 10_000, killer: "b", victim: "r", victimPos: { x: 1, y: 1 } },
    { type: "plant", t: 40_000, planter: "r2", site: "A", pos: { x: 5, y: 5 } },
    { type: "defuse", t: 70_000, defuser: "b" },
  ],
  snapshots: [
    { t: 10_000, source: "kill", players: [] },
    { t: 40_000, source: "plant", players: [] },
  ],
};

describe("snapshotAt", () => {
  it("returns nothing before the first known snapshot", () => {
    expect(snapshotAt(round, 9_999)).toBeUndefined();
  });

  it("holds the latest snapshot at or before t, never a blend", () => {
    expect(snapshotAt(round, 10_000)?.t).toBe(10_000);
    expect(snapshotAt(round, 39_999)?.t).toBe(10_000);
    expect(snapshotAt(round, 65_000)?.t).toBe(40_000);
  });
});

describe("events", () => {
  it("finds kills for a kill snapshot only", () => {
    const [kill, plant] = round.snapshots;
    expect(kill && killsAtSnapshot(round, kill)).toHaveLength(1);
    expect(plant && killsAtSnapshot(round, plant)).toHaveLength(0);
  });

  it("shows the spike only once planted", () => {
    expect(plantAt(round, 39_999)).toBeUndefined();
    expect(plantAt(round, 40_000)?.site).toBe("A");
  });

  it("extends the timeline to the last event", () => {
    expect(timelineEnd({ ...round, durationMs: 0 })).toBe(70_000);
  });
});

describe("formatting", () => {
  it("formats round time as m:ss", () => {
    expect(formatRoundTime(0)).toBe("0:00");
    expect(formatRoundTime(65_432)).toBe("1:05");
  });

  it("labels players anonymously relative to the viewer", () => {
    const replay: MatchReplay = {
      matchId: "m",
      mapId: "x",
      gameStartMillis: 0,
      selfPuuid: "me",
      rounds: [],
      players: [
        { puuid: "r1", team: "Red", isSelf: false },
        { puuid: "me", team: "Blue", isSelf: true },
        { puuid: "b1", team: "Blue", isSelf: false },
      ],
    };
    expect(Object.fromEntries(playerLabels(replay))).toEqual({
      r1: "Enemy 1",
      me: "You",
      b1: "Ally 1",
    });
  });
});
