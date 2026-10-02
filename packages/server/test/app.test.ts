import { describe, expect, it } from "vitest";
import { ApiErrorSchema, MatchReplaySchema, MatchSummarySchema } from "@replay-lab/shared";
import { FIXTURE_MATCHES_DIR, SELF_PUUID } from "@replay-lab/fixtures";
import { buildApp } from "../src/app.js";
import { EMPTY_CONTENT } from "../src/content/valorantApi.js";
import { RiotApiError } from "../src/riot/errors.js";
import { FixtureRiotClient } from "../src/riot/FixtureRiotClient.js";
import { StratStore } from "../src/strats/StratStore.js";
import { fixedSession } from "../src/session.js";

const riot = new FixtureRiotClient(FIXTURE_MATCHES_DIR);
const content = async () => EMPTY_CONTENT;
const base = { riot, content, maxMatches: 10, strats: new StratStore(":memory:") };
const app = buildApp({
  ...base,
  session: fixedSession({ source: "fixture", puuid: SELF_PUUID, riotId: "Sample player" }),
});
const signedOut = buildApp({ ...base, session: async () => undefined });

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
      "fx-match-0007-lotus",
      "fx-match-0006-bind",
      "fx-match-0005-haven",
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

  it("reports the session without the puuid", async () => {
    const res = await app.inject({ method: "GET", url: "/api/session" });
    expect(res.json()).toEqual({ source: "fixture", riotId: "Sample player" });
  });

  it("serves content even when it is unavailable", async () => {
    const res = await app.inject({ method: "GET", url: "/api/content" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ available: false });
  });

  it("turns Riot errors into a typed upstream error with a safe message", async () => {
    const failing = buildApp({
      ...base,
      session: async () => {
        throw new RiotApiError("forbidden", 403);
      },
    });
    const res = await failing.inject({ method: "GET", url: "/api/matches" });
    expect(res.statusCode).toBe(502);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe("UPSTREAM");
    expect(body.error.message).toMatch(/production key/);
  });

  it("limits the list to maxMatches", async () => {
    const one = buildApp({
      ...base,
      maxMatches: 1,
      session: fixedSession({ source: "fixture", puuid: SELF_PUUID }),
    });
    const res = await one.inject({ method: "GET", url: "/api/matches" });
    expect(res.json()).toHaveLength(1);
  });
});
