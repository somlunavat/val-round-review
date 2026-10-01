import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MatchReplay, MatchSummary, SessionInfo } from "@replay-lab/shared";
import { RiotApiError } from "../riot/errors.js";
import type { RiotClient } from "../riot/RiotClient.js";
import type { SessionResolver } from "../session.js";
import { sendError } from "../errors.js";
import { NotParticipantError, toMatchReplay, toMatchSummary } from "../transform/toReplay.js";

const MatchIdParams = z.object({ id: z.string().regex(/^[A-Za-z0-9-]{1,64}$/) });

export function matchRoutes(
  app: FastifyInstance,
  deps: { riot: RiotClient; session: SessionResolver; maxMatches: number },
) {
  app.get("/api/session", async (req, reply) => {
    const session = await deps.session(req);
    if (!session) return sendError(reply, "UNAUTHORIZED", "Not signed in");
    const info: SessionInfo = { source: session.source, riotId: session.riotId };
    return info;
  });

  /** The signed-in player's own matches. There is deliberately no by-puuid variant. */
  app.get("/api/matches", async (req, reply) => {
    const self = (await deps.session(req))?.puuid;
    if (!self) return sendError(reply, "UNAUTHORIZED", "Sign in to see your matches");

    const list = await deps.riot.getMatchlist(self);
    const recent = [...list.history]
      .sort((a, b) => b.gameStartTimeMillis - a.gameStartTimeMillis)
      .slice(0, deps.maxMatches);
    const summaries: MatchSummary[] = [];
    for (const entry of recent) {
      try {
        const match = await deps.riot.getMatch(entry.matchId);
        if (match) summaries.push(toMatchSummary(match, self));
      } catch (err) {
        // One malformed match shouldn't hide the rest of the list.
        if (err instanceof RiotApiError && err.kind === "invalid_response") continue;
        throw err;
      }
    }
    summaries.sort((a, b) => b.gameStartMillis - a.gameStartMillis);
    return summaries;
  });

  app.get("/api/matches/:id", async (req, reply) => {
    const self = (await deps.session(req))?.puuid;
    if (!self) return sendError(reply, "UNAUTHORIZED", "Sign in to see your matches");

    const params = MatchIdParams.safeParse(req.params);
    if (!params.success) return sendError(reply, "BAD_REQUEST", "Invalid match id");

    const match = await deps.riot.getMatch(params.data.id);
    // Matches you did not play in look exactly like matches that do not exist.
    if (!match) return sendError(reply, "NOT_FOUND", "Match not found");
    try {
      const replay: MatchReplay = toMatchReplay(match, self);
      return replay;
    } catch (err) {
      if (err instanceof NotParticipantError)
        return sendError(reply, "NOT_FOUND", "Match not found");
      throw err;
    }
  });
}
