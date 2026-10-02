import { describe, expect, it } from "vitest";
import type { Strat } from "@replay-lab/shared";
import { FIXTURE_MATCHES_DIR } from "@replay-lab/fixtures";
import { buildApp } from "../src/app.js";
import { EMPTY_CONTENT } from "../src/content/valorantApi.js";
import { FixtureRiotClient } from "../src/riot/FixtureRiotClient.js";
import { fixedSession } from "../src/session.js";
import { StratStore } from "../src/strats/StratStore.js";

const strats = new StratStore(":memory:");
const deps = {
  riot: new FixtureRiotClient(FIXTURE_MATCHES_DIR),
  content: async () => EMPTY_CONTENT,
  maxMatches: 10,
  strats,
};
const alice = buildApp({ ...deps, session: fixedSession({ source: "fixture", puuid: "alice" }) });
const bob = buildApp({ ...deps, session: fixedSession({ source: "fixture", puuid: "bob" }) });

const strat: Strat = {
  id: "s1",
  title: "A split",
  mapPath: "/Game/Maps/Ascent/Ascent",
  side: "attack",
  notes: "Smoke tree and heaven, Jett entry.",
  updatedAt: 1,
  frames: [
    {
      id: "f1",
      name: "Setup",
      tokens: [{ id: "t1", side: "ally", at: [0.3, 0.2] }],
      shapes: [
        {
          id: "p1",
          kind: "path",
          points: [
            [0.1, 0.1],
            [0.2, 0.2],
          ],
          color: "#ff4655",
          arrow: true,
        },
        { id: "u1", kind: "utility", type: "smoke", at: [0.35, 0.15], color: "#ece8e1" },
      ],
    },
  ],
};

describe("strat routes", () => {
  it("saves, lists, loads, and deletes a strat", async () => {
    const put = await alice.inject({ method: "PUT", url: "/api/strats/s1", payload: strat });
    expect(put.statusCode).toBe(200);
    const list = await alice.inject({ method: "GET", url: "/api/strats" });
    expect(list.json()).toEqual([
      { id: "s1", title: "A split", mapPath: strat.mapPath, side: "attack", updatedAt: 1 },
    ]);
    const got = await alice.inject({ method: "GET", url: "/api/strats/s1" });
    expect(got.json()).toEqual(strat);
    const del = await alice.inject({ method: "DELETE", url: "/api/strats/s1" });
    expect(del.statusCode).toBe(200);
    expect((await alice.inject({ method: "GET", url: "/api/strats/s1" })).statusCode).toBe(404);
  });

  it("keeps each player's strats private", async () => {
    await alice.inject({ method: "PUT", url: "/api/strats/s2", payload: { ...strat, id: "s2" } });
    expect((await bob.inject({ method: "GET", url: "/api/strats/s2" })).statusCode).toBe(404);
    expect((await bob.inject({ method: "GET", url: "/api/strats" })).json()).toEqual([]);
    expect((await bob.inject({ method: "DELETE", url: "/api/strats/s2" })).statusCode).toBe(404);
  });

  it("rejects malformed strats and mismatched ids", async () => {
    const bad = await alice.inject({
      method: "PUT",
      url: "/api/strats/s3",
      payload: { ...strat, id: "s3", frames: [] },
    });
    expect(bad.statusCode).toBe(400);
    const mismatch = await alice.inject({
      method: "PUT",
      url: "/api/strats/other",
      payload: strat,
    });
    expect(mismatch.statusCode).toBe(400);
  });
});
