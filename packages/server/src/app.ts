import Fastify, { type FastifyInstance } from "fastify";
import type { ApiError } from "@replay-lab/shared";
import type { AppDeps } from "./config.js";
import { RiotApiError } from "./riot/errors.js";
import { contentRoutes } from "./routes/content.js";
import { mapRoutes } from "./routes/maps.js";
import { stratRoutes } from "./routes/strats.js";
import { matchRoutes } from "./routes/matches.js";

export function buildApp(deps: AppDeps): FastifyInstance {
  // Outbound Riot calls carry the key in a header; redact header-shaped fields defensively.
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "req.headers['x-riot-token']"],
    },
  });

  app.get("/api/health", async () => ({ ok: true }));
  matchRoutes(app, deps);
  mapRoutes(app);
  contentRoutes(app, deps);
  stratRoutes(app, deps);

  app.setNotFoundHandler((_req, reply) => {
    const body: ApiError = { error: { code: "NOT_FOUND", message: "Route not found" } };
    return reply.status(404).send(body);
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof RiotApiError) {
      app.log.warn({ msg: "Riot API error", kind: err.kind, status: err.status });
      const body: ApiError = { error: { code: "UPSTREAM", message: err.message } };
      return reply.status(502).send(body);
    }
    app.log.error(
      err instanceof Error ? { msg: err.message, name: err.name } : { msg: "Unknown error" },
    );
    const body: ApiError = { error: { code: "INTERNAL", message: "Something went wrong" } };
    return reply.status(500).send(body);
  });

  return app;
}
