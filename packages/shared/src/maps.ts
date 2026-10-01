/**
 * Map identity, calibration, and callout points for every supported map.
 * Data lives in mapData.ts (generated from valorant-api.com, numbers only).
 */
import { z } from "zod";
import { MAP_DATA } from "./mapData.js";

export const MapInfoSchema = z.object({
  mapPath: z.string(),
  displayName: z.string(),
});
export type MapInfo = z.infer<typeof MapInfoSchema>;

/** A named area with a reference point in game units (z is floor height). */
export type Callout = {
  name: string;
  region: string;
  pos: { x: number; y: number; z: number };
};

/**
 * Game x/y -> normalized minimap coordinates (0..1). Note the axis swap:
 * game Y drives horizontal, game X drives vertical.
 */
export type MapCalibration = {
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
};

export type MapData = MapInfo & MapCalibration & { callouts: Callout[] };

export const KNOWN_MAPS: readonly MapInfo[] = MAP_DATA.map(({ mapPath, displayName }) => ({
  mapPath,
  displayName,
}));

export function mapData(mapPath: string): MapData | undefined {
  return MAP_DATA.find((m) => m.mapPath === mapPath);
}

export function mapDisplayName(mapPath: string): string {
  return mapData(mapPath)?.displayName ?? "Unknown map";
}

export { MAP_DATA };
