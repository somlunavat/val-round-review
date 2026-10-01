export type RiotErrorKind =
  "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "unavailable" | "invalid_response";

/** A failed Riot call. Messages are safe to show users: no URLs, headers, or keys. */
export class RiotApiError extends Error {
  constructor(
    readonly kind: RiotErrorKind,
    readonly status?: number,
  ) {
    super(RIOT_ERROR_MESSAGES[kind]);
    this.name = "RiotApiError";
  }
}

export const RIOT_ERROR_MESSAGES: Record<RiotErrorKind, string> = {
  unauthorized:
    "Riot didn't accept the API key (401). Check RIOT_API_KEY in .env. Development keys expire every 24 hours; regenerate one at developer.riotgames.com.",
  forbidden:
    "Riot refused the request (403). This key can't use that endpoint: match data (VAL-MATCH-V1) needs an approved production key, which development keys don't have.",
  not_found: "Riot couldn't find that. Check the Riot ID and region in .env.",
  rate_limited: "Hit Riot's rate limit. Wait a minute and try again.",
  unavailable: "Riot's API isn't responding right now. Try again shortly.",
  invalid_response: "Riot sent data in a shape we don't understand yet.",
};
