import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Content } from "@replay-lab/shared";
import { MatchCache } from "./cache/MatchCache.js";
import { contentProvider } from "./content/valorantApi.js";
import { FixtureRiotClient } from "./riot/FixtureRiotClient.js";
import { LiveRiotClient } from "./riot/LiveRiotClient.js";
import { RateLimiter, parseLimits } from "./riot/rateLimit.js";
import type { RiotClient } from "./riot/RiotClient.js";
import { fixedSession, lazySession, type SessionResolver } from "./session.js";
import { StratStore } from "./strats/StratStore.js";

export type AppDeps = {
  riot: RiotClient;
  session: SessionResolver;
  content: () => Promise<Content>;
  maxMatches: number;
  strats: StratStore;
};

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Dev key limits. Production keys get higher ones; override with RIOT_RATE_LIMITS. */
const DEFAULT_LIMITS = "20:1,100:120";

export class ConfigError extends Error {}

/** Builds dependencies from the environment. Throws ConfigError with a fix-it message. */
export async function depsFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<AppDeps> {
  const source = env.RIOT_SOURCE ?? "fixture";
  const maxMatches = Number(env.MAX_MATCHES ?? 10);
  const content = contentProvider();
  const strats = new StratStore(env.STRATS_PATH ?? join(REPO_ROOT, ".cache", "strats.sqlite"));

  if (source === "fixture") {
    // Imported only in fixture mode so live deployments never load sample data.
    const { FIXTURE_MATCHES_DIR, SELF_PUUID } = await import("@replay-lab/fixtures");
    return {
      riot: new FixtureRiotClient(env.FIXTURE_DIR ?? FIXTURE_MATCHES_DIR),
      session: fixedSession({
        source: "fixture",
        puuid: env.DEV_SESSION_PUUID || SELF_PUUID,
        riotId: "Sample player",
      }),
      content,
      maxMatches,
      strats,
    };
  }

  if (source !== "live")
    throw new ConfigError(`RIOT_SOURCE must be "fixture" or "live", got "${source}"`);

  const apiKey = env.RIOT_API_KEY?.trim();
  if (!apiKey) throw new ConfigError("RIOT_SOURCE=live needs RIOT_API_KEY in .env");
  const riotId = env.RIOT_ID?.trim() ?? "";
  const [gameName, tagLine] = riotId.split("#");
  if (!gameName || !tagLine) {
    throw new ConfigError('RIOT_SOURCE=live needs RIOT_ID in .env, e.g. RIOT_ID="YourName#NA1"');
  }

  const riot = new LiveRiotClient({
    apiKey,
    shard: env.RIOT_SHARD ?? "na",
    accountRegion: env.RIOT_ACCOUNT_REGION ?? "americas",
    limiter: new RateLimiter(parseLimits(env.RIOT_RATE_LIMITS ?? DEFAULT_LIMITS)),
    cache: new MatchCache(env.CACHE_PATH ?? join(REPO_ROOT, ".cache", "matches.sqlite")),
  });

  return {
    riot,
    // Stand-in for RSO: the owner's own Riot ID from server config, never from a request.
    session: lazySession(async () => {
      const account = await riot.getAccountByRiotId(gameName, tagLine);
      return {
        source: "live",
        puuid: account.puuid,
        riotId: `${account.gameName ?? gameName}#${account.tagLine ?? tagLine}`,
      };
    }),
    content,
    maxMatches,
    strats,
  };
}
