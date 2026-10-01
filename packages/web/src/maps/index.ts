import { ascent } from "./ascent.js";
import type { MapConfig } from "./types.js";

const MAPS: readonly MapConfig[] = [ascent];

export function mapConfigFor(mapPath: string): MapConfig | undefined {
  return MAPS.find((m) => m.calibration.mapPath === mapPath);
}

export type { MapConfig, MapCalibration, Callout } from "./types.js";
