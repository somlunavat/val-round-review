import { z } from "zod";
import { MatchSchema, MatchlistSchema, type Match, type Matchlist } from "@replay-lab/shared";
import type { MatchCache } from "../cache/MatchCache.js";
import { RiotApiError } from "./errors.js";
import type { RateLimiter } from "./rateLimit.js";
import { realClock, type Clock } from "./rateLimit.js";
import type { RiotClient } from "./RiotClient.js";

export type LiveRiotClientOptions = {
  apiKey: string;
  /** VALORANT shard for VAL-MATCH-V1: na, eu, ap, kr, latam, br. */
  shard: string;
  /** Regional route for ACCOUNT-V1: americas, europe, asia. */
  accountRegion: string;
  limiter: RateLimiter;
  cache?: MatchCache;
  fetch?: typeof fetch;
  clock?: Clock;
  maxRetries?: number;
};

const AccountSchema = z.object({
  puuid: z.string(),
  gameName: z.string().nullish(),
  tagLine: z.string().nullish(),
});
export type RiotAccount = z.infer<typeof AccountSchema>;

const MATCHLIST_TTL_MS = 60_000;

/**
 * Calls the real Riot API. The key is only ever placed in the X-Riot-Token
 * header; it never appears in URLs, errors, or logs.
 */
export class LiveRiotClient implements RiotClient {
  private readonly fetch: typeof fetch;
  private readonly clock: Clock;
  private readonly maxRetries: number;
  private readonly matchlists = new Map<string, { at: number; value: Matchlist }>();

  constructor(private readonly opts: LiveRiotClientOptions) {
    this.fetch = opts.fetch ?? globalThis.fetch;
    this.clock = opts.clock ?? realClock;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  async getMatch(matchId: string): Promise<Match | undefined> {
    const cached = this.opts.cache?.get(matchId);
    if (cached !== undefined) return MatchSchema.parse(cached);

    const raw = await this.get(this.valUrl(`/val/match/v1/matches/${encodeURIComponent(matchId)}`));
    if (raw === undefined) return undefined;
    const match = parse(MatchSchema, raw);
    // Only completed matches are immutable; anything else could still change.
    if (match.matchInfo.isCompleted) this.opts.cache?.put(matchId, match);
    return match;
  }

  async getMatchlist(puuid: string): Promise<Matchlist> {
    const hit = this.matchlists.get(puuid);
    if (hit && this.clock.now() - hit.at < MATCHLIST_TTL_MS) return hit.value;
    const raw = await this.get(
      this.valUrl(`/val/match/v1/matchlists/by-puuid/${encodeURIComponent(puuid)}`),
    );
    const value = raw === undefined ? { puuid, history: [] } : parse(MatchlistSchema, raw);
    this.matchlists.set(puuid, { at: this.clock.now(), value });
    return value;
  }

  /** ACCOUNT-V1 lookup for the configured owner only (stand-in until RSO). */
  async getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount> {
    const url = `https://${this.opts.accountRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const raw = await this.get(url);
    if (raw === undefined) throw new RiotApiError("not_found", 404);
    return parse(AccountSchema, raw);
  }

  private valUrl(path: string): string {
    return `https://${this.opts.shard}.api.riotgames.com${path}`;
  }

  /** GET with rate limiting and retries. Returns undefined on 404. */
  private async get(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      await this.opts.limiter.take();
      let res: Response;
      try {
        res = await this.fetch(url, { headers: { "X-Riot-Token": this.opts.apiKey } });
      } catch {
        if (attempt < this.maxRetries) {
          await this.clock.sleep(backoff(attempt));
          continue;
        }
        throw new RiotApiError("unavailable");
      }

      if (res.ok) return (await res.json()) as unknown;
      if (res.status === 404) return undefined;
      if (res.status === 401) throw new RiotApiError("unauthorized", 401);
      if (res.status === 403) throw new RiotApiError("forbidden", 403);

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.maxRetries) {
        throw new RiotApiError(res.status === 429 ? "rate_limited" : "unavailable", res.status);
      }
      const retryAfter = Number(res.headers.get("Retry-After"));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000 + Math.random() * 250
          : backoff(attempt);
      await this.clock.sleep(wait);
    }
  }
}

/** Exponential backoff with full jitter: 0.5 s, 1 s, 2 s … ceilings. */
function backoff(attempt: number): number {
  return Math.random() * 500 * 2 ** attempt;
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new RiotApiError("invalid_response");
  return result.data;
}
