import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { ConfigError, depsFromEnv } from "./config.js";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.PORT ?? 8787);

try {
  const app = buildApp(await depsFromEnv());
  await app.listen({ port, host: "127.0.0.1" });
} catch (err) {
  console.error(err instanceof ConfigError ? `Config error: ${err.message}` : "Failed to start");
  process.exit(1);
}
