import type { Match, Matchlist } from "@replay-lab/shared";

/**
 * The only way the server gets match data. Implementations validate payloads
 * with Zod before returning them, so callers can trust the types.
 */
export interface RiotClient {
  /** Returns undefined when the match does not exist. */
  getMatch(matchId: string): Promise<Match | undefined>;
  getMatchlist(puuid: string): Promise<Matchlist>;
}
