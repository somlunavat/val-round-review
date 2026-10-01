import { describe, expect, it } from "vitest";
import { fixtureSet } from "@replay-lab/fixtures";
import { MatchCache } from "../src/cache/MatchCache.js";
import { RiotApiError } from "../src/riot/errors.js";
import { LiveRiotClient } from "../src/riot/LiveRiotClient.js";
import { RateLimiter, parseLimits, type Clock } from "../src/riot/rateLimit.js";

function fakeClock(): Clock & { slept: number[] } {
  let now = 0;
  const slept: number[] = [];
  return {
    slept,
    now: () => now,
    sleep: async (ms) => {
      slept.push(ms);
      now += ms;
    },
  };
}

type Call = { url: string; token: string | null };

function fakeFetch(responses: (() => Response)[]) {
  const calls: Call[] = [];
  const impl = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), token: new Headers(init?.headers).get("X-Riot-Token") });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next();
  };
  return { calls, impl: impl as typeof fetch };
}

const json =
  (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });

const match = fixtureSet()[0];
if (!match) throw new Error("fixture missing");

function client(responses: (() => Response)[], cache?: MatchCache) {
  const clock = fakeClock();
  const f = fakeFetch(responses);
  const riot = new LiveRiotClient({
    apiKey: "RGAPI-test",
    shard: "na",
    accountRegion: "americas",
    limiter: new RateLimiter([{ tokens: 100, perMs: 1000 }], clock),
    fetch: f.impl,
    clock,
    ...(cache ? { cache } : {}),
  });
  return { riot, calls: f.calls, clock };
}

describe("LiveRiotClient", () => {
  it("sends the key only as a header and validates the match", async () => {
    const { riot, calls } = client([json(match)]);
    const got = await riot.getMatch(match.matchInfo.matchId);
    expect(got?.matchInfo.matchId).toBe(match.matchInfo.matchId);
    expect(calls[0]?.url).toBe(
      `https://na.api.riotgames.com/val/match/v1/matches/${match.matchInfo.matchId}`,
    );
    expect(calls[0]?.url).not.toContain("RGAPI");
    expect(calls[0]?.token).toBe("RGAPI-test");
  });

  it("caches completed matches and serves them without a request", async () => {
    const cache = new MatchCache(":memory:");
    const first = client([json(match)], cache);
    await first.riot.getMatch(match.matchInfo.matchId);
    const second = client([], cache);
    expect((await second.riot.getMatch(match.matchInfo.matchId))?.roundResults.length).toBe(
      match.roundResults.length,
    );
    expect(second.calls).toHaveLength(0);
  });

  it("returns undefined for 404", async () => {
    const { riot } = client([json({}, 404)]);
    expect(await riot.getMatch("missing")).toBeUndefined();
  });

  it("explains 403 as a key problem", async () => {
    const { riot } = client([json({}, 403)]);
    await expect(riot.getMatchlist("p")).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("retries 429 after Retry-After, then succeeds", async () => {
    const { riot, clock } = client([
      json({}, 429, { "Retry-After": "2" }),
      json({ puuid: "p", history: [] }),
    ]);
    expect(await riot.getMatchlist("p")).toEqual({ puuid: "p", history: [] });
    expect(clock.slept.some((ms) => ms >= 2000)).toBe(true);
  });

  it("gives up after repeated 5xx", async () => {
    const { riot } = client([json({}, 503), json({}, 503), json({}, 503), json({}, 503)]);
    await expect(riot.getMatchlist("p")).rejects.toBeInstanceOf(RiotApiError);
  });

  it("rejects payloads that fail validation", async () => {
    const { riot } = client([json({ matchInfo: {} })]);
    await expect(riot.getMatch("x")).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("looks up the owner's account", async () => {
    const { riot, calls } = client([json({ puuid: "abc", gameName: "Me", tagLine: "NA1" })]);
    expect((await riot.getAccountByRiotId("Me", "NA1")).puuid).toBe("abc");
    expect(calls[0]?.url).toBe(
      "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Me/NA1",
    );
  });
});

describe("RateLimiter", () => {
  it("waits when a bucket is empty", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter([{ tokens: 2, perMs: 1000 }], clock);
    await limiter.take();
    await limiter.take();
    await limiter.take();
    expect(clock.now()).toBeGreaterThanOrEqual(500);
  });

  it("parses Riot limit strings", () => {
    expect(parseLimits("20:1,100:120")).toEqual([
      { tokens: 20, perMs: 1000 },
      { tokens: 100, perMs: 120_000 },
    ]);
  });
});
