export { generateMatch, fixtureSet, SELF_PUUID, FIXTURE_MAP } from "./generate.js";
export type { GenerateOptions, EdgeCaseOptions } from "./generate.js";

import { fileURLToPath } from "node:url";

/** Absolute path to the committed fixture match JSON files. */
export const FIXTURE_MATCHES_DIR = fileURLToPath(new URL("../matches/", import.meta.url));
