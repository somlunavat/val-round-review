import { describe, expect, it } from "vitest";
import { MatchSchema } from "../src/match.js";

const minimal = {
  matchInfo: {
    matchId: "m1",
    mapId: "/Game/Maps/Ascent/Ascent",
    gameStartMillis: 0,
    isCompleted: true,
  },
  players: [{ puuid: "p1", teamId: "Blue" }],
  roundResults: [
    {
      roundNum: 0,
      roundResult: "Eliminated",
      winningTeam: "Blue",
      playerStats: [{ puuid: "p1" }],
    },
  ],
};

describe("MatchSchema", () => {
  it("accepts a payload with only the required fields", () => {
    expect(MatchSchema.safeParse(minimal).success).toBe(true);
  });

  it("accepts nulls for optional fields", () => {
    const withNulls = {
      ...minimal,
      roundResults: [{ ...minimal.roundResults[0], bombPlanter: null, plantPlayerLocations: null }],
    };
    expect(MatchSchema.safeParse(withNulls).success).toBe(true);
  });

  it("strips fields we have not declared", () => {
    const parsed = MatchSchema.parse({ ...minimal, somethingNew: 1 });
    expect(parsed).not.toHaveProperty("somethingNew");
  });

  it("rejects a kill without a victim location", () => {
    const bad = {
      ...minimal,
      roundResults: [
        {
          ...minimal.roundResults[0],
          playerStats: [
            {
              puuid: "p1",
              kills: [{ timeSinceGameStartMillis: 1, timeSinceRoundStartMillis: 1, victim: "p2" }],
            },
          ],
        },
      ],
    };
    expect(MatchSchema.safeParse(bad).success).toBe(false);
  });
});
