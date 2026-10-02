export {
  generateMatch,
  fixtureSet,
  routesFor,
  SELF_PUUID,
  FIXTURE_MAP,
  FIXTURE_MAPS,
} from "./generate.js";
export { cachedMasks, loadMasks } from "./masks.js";
export type { GenerateOptions, EdgeCaseOptions } from "./generate.js";

import { fileURLToPath } from "node:url";

/** Absolute path to the committed fixture match JSON files. */
export const FIXTURE_MATCHES_DIR = fileURLToPath(new URL("../matches/", import.meta.url));
