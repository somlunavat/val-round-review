import type { FastifyRequest } from "fastify";
import type { SessionInfo } from "@replay-lab/shared";

/**
 * Resolves the signed-in player for a request.
 *
 * This is the only source of "whose data" for every route. No route accepts a
 * puuid or Riot ID from the client, so the API cannot be used to look up other
 * players. Until RSO lands, the owner's identity comes from server config.
 */
export type Session = SessionInfo & { puuid: string };
export type SessionResolver = (req: FastifyRequest) => Promise<Session | undefined>;

export function fixedSession(session: Session): SessionResolver {
  return async () => session;
}

/** Resolves the configured owner's puuid once, retrying after a failure. */
export function lazySession(resolve: () => Promise<Session>): SessionResolver {
  let pending: Promise<Session> | undefined;
  return async () => {
    pending ??= resolve().catch((err: unknown) => {
      pending = undefined;
      throw err;
    });
    return pending;
  };
}
