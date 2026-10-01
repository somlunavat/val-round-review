import type { FastifyInstance } from "fastify";
import type { Content } from "@replay-lab/shared";

/** Display names and image URLs. Never fails: returns `available: false` when offline. */
export function contentRoutes(app: FastifyInstance, deps: { content: () => Promise<Content> }) {
  app.get("/api/content", async () => deps.content());
}
