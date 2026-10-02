import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { StratSchema } from "@replay-lab/shared";
import { sendError } from "../errors.js";
import type { SessionResolver } from "../session.js";
import type { StratStore } from "../strats/StratStore.js";

const Params = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/) });

/** A player's own strategy boards. Every query is scoped to the session's puuid. */
export function stratRoutes(
  app: FastifyInstance,
  deps: { strats: StratStore; session: SessionResolver },
) {
  const owner = async (req: Parameters<SessionResolver>[0]) => (await deps.session(req))?.puuid;

  app.get("/api/strats", async (req, reply) => {
    const me = await owner(req);
    if (!me) return sendError(reply, "UNAUTHORIZED", "Sign in to see your strats");
    return deps.strats.list(me);
  });

  app.get("/api/strats/:id", async (req, reply) => {
    const me = await owner(req);
    if (!me) return sendError(reply, "UNAUTHORIZED", "Sign in to see your strats");
    const params = Params.safeParse(req.params);
    if (!params.success) return sendError(reply, "BAD_REQUEST", "Invalid strat id");
    const strat = deps.strats.get(me, params.data.id);
    return strat ?? sendError(reply, "NOT_FOUND", "Strat not found");
  });

  app.put("/api/strats/:id", { bodyLimit: 2_000_000 }, async (req, reply) => {
    const me = await owner(req);
    if (!me) return sendError(reply, "UNAUTHORIZED", "Sign in to save strats");
    const params = Params.safeParse(req.params);
    const body = StratSchema.safeParse(req.body);
    if (!params.success || !body.success || body.data.id !== params.data.id) {
      return sendError(
        reply,
        "BAD_REQUEST",
        "That strat couldn't be saved: it isn't in the expected shape.",
      );
    }
    deps.strats.put(me, body.data);
    return { ok: true };
  });

  app.delete("/api/strats/:id", async (req, reply) => {
    const me = await owner(req);
    if (!me) return sendError(reply, "UNAUTHORIZED", "Sign in to delete strats");
    const params = Params.safeParse(req.params);
    if (!params.success) return sendError(reply, "BAD_REQUEST", "Invalid strat id");
    return deps.strats.delete(me, params.data.id)
      ? { ok: true }
      : sendError(reply, "NOT_FOUND", "Strat not found");
  });
}
