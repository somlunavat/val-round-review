import { FIXTURE_MATCHES_DIR, SELF_PUUID } from "@replay-lab/fixtures";
import { FixtureRiotClient } from "./riot/FixtureRiotClient.js";
import type { RiotClient } from "./riot/RiotClient.js";
import { devSession, type SessionResolver } from "./session.js";

export type AppDeps = { riot: RiotClient; session: SessionResolver };

/** Builds dependencies from the environment. Only the fixture source exists so far. */
export function depsFromEnv(env: NodeJS.ProcessEnv = process.env): AppDeps {
  const source = env.RIOT_SOURCE ?? "fixture";
  if (source !== "fixture") {
    throw new Error(`RIOT_SOURCE=${source} is not supported yet; only "fixture" is available`);
  }
  return {
    riot: new FixtureRiotClient(env.FIXTURE_DIR ?? FIXTURE_MATCHES_DIR),
    session: devSession(env.DEV_SESSION_PUUID || SELF_PUUID),
  };
}
