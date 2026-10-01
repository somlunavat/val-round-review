import type { FastifyInstance } from "fastify";
import { KNOWN_MAPS } from "@replay-lab/shared";

export function mapRoutes(app: FastifyInstance) {
  app.get("/api/maps", async () => KNOWN_MAPS);
}
