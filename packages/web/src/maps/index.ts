import { mapData, type MapData } from "@replay-lab/shared";

/** Calibration + callouts for a map path, or undefined if the map isn't supported yet. */
export function mapConfigFor(mapPath: string): MapConfig | undefined {
  return mapData(mapPath);
}

export type MapConfig = MapData;
