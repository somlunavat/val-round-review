import type { FastifyRequest } from "fastify";

/**
 * Resolves the signed-in player's puuid for a request.
 *
 * This is the only source of "whose data" for every route. No route accepts a
 * puuid from the client, so the API cannot be used to look up other players.
 * Until RSO lands, the dev resolver returns a fixed puuid from config.
 */
export type SessionResolver = (req: FastifyRequest) => string | undefined;

export function devSession(puuid: string): SessionResolver {
  return () => puuid;
}
