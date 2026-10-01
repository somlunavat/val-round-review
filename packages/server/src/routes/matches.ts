import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MatchReplay, MatchSummary } from "@replay-lab/shared";
import type { RiotClient } from "../riot/RiotClient.js";
import type { SessionResolver } from "../session.js";
import { sendError } from "../errors.js";
import { NotParticipantError, toMatchReplay, toMatchSummary } from "../transform/toReplay.js";

const MatchIdParams = z.object({ id: z.string().regex(/^[A-Za-z0-9-]{1,64}$/) });

export function matchRoutes(
  app: FastifyInstance,
  deps: { riot: RiotClient; session: SessionResolver },
) {
  /** The signed-in player's own matches. There is deliberately no by-puuid variant. */
  app.get("/api/matches", async (req, reply) => {
    const self = deps.session(req);
    if (!self) return sendError(reply, "UNAUTHORIZED", "Sign in to see your matches");

    const list = await deps.riot.getMatchlist(self);
    const summaries: MatchSummary[] = [];
    for (const entry of list.history) {
      const match = await deps.riot.getMatch(entry.matchId);
      if (match) summaries.push(toMatchSummary(match, self));
    }
    summaries.sort((a, b) => b.gameStartMillis - a.gameStartMillis);
    return summaries;
  });

  app.get("/api/matches/:id", async (req, reply) => {
    const self = deps.session(req);
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
