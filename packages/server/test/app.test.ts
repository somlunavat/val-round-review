import { describe, expect, it } from "vitest";
import { ApiErrorSchema, MatchReplaySchema, MatchSummarySchema } from "@replay-lab/shared";
import { FIXTURE_MATCHES_DIR, SELF_PUUID } from "@replay-lab/fixtures";
import { buildApp } from "../src/app.js";
import { FixtureRiotClient } from "../src/riot/FixtureRiotClient.js";
import { devSession } from "../src/session.js";

const riot = new FixtureRiotClient(FIXTURE_MATCHES_DIR);
const app = buildApp({ riot, session: devSession(SELF_PUUID) });
const signedOut = buildApp({ riot, session: () => undefined });

describe("app", () => {
  it("answers the health check", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("returns a typed error for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  it("lists only the player's own matches, newest first", async () => {
    const res = await app.inject({ method: "GET", url: "/api/matches" });
    expect(res.statusCode).toBe(200);
    const list = MatchSummarySchema.array().parse(res.json());
    expect(list.map((m) => m.matchId)).toEqual([
      "fx-match-0003-edge-cases",
      "fx-match-0002-overtime",
      "fx-match-0001-standard",
    ]);
  });

  it("serves a replay for an own match", async () => {
    const res = await app.inject({ method: "GET", url: "/api/matches/fx-match-0001-standard" });
    expect(res.statusCode).toBe(200);
    const replay = MatchReplaySchema.parse(res.json());
    expect(replay.selfPuuid).toBe(SELF_PUUID);
    expect(replay.rounds.length).toBeGreaterThanOrEqual(13);
  });

  it("treats someone else's match as not found", async () => {
    const res = await app.inject({ method: "GET", url: "/api/matches/fx-match-0004-not-own" });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("NOT_FOUND");
  });

  it("rejects malformed match ids", async () => {
    const res = await app.inject({ method: "GET", url: "/api/matches/..%2F..%2Fetc" });
    expect(res.statusCode).toBe(400);
  });

  it("requires a session", async () => {
    const res = await signedOut.inject({ method: "GET", url: "/api/matches" });
    expect(res.statusCode).toBe(401);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("serves the map list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/maps" });
    expect(res.statusCode).toBe(200);
  });
});
