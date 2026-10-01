import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const app = buildApp();

app.listen({ port, host: "127.0.0.1" }).catch((err: unknown) => {
  app.log.error(err instanceof Error ? err.message : "Failed to start");
  process.exit(1);
});
