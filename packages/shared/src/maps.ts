/**
 * Map identity only (path -> display name). Calibration and geometry live in
 * packages/web/src/maps/ per CLAUDE.md §7.
 *
 * Paths are the internal map ids returned as `matchInfo.mapId`. VERIFY each
 * against VAL-CONTENT-V1 before relying on it.
 */
import { z } from "zod";

export const MapInfoSchema = z.object({
  mapPath: z.string(),
  displayName: z.string(),
});
export type MapInfo = z.infer<typeof MapInfoSchema>;

export const KNOWN_MAPS: readonly MapInfo[] = [
  { mapPath: "/Game/Maps/Ascent/Ascent", displayName: "Ascent" },
  { mapPath: "/Game/Maps/Bonsai/Bonsai", displayName: "Split" },
  { mapPath: "/Game/Maps/Duality/Duality", displayName: "Bind" },
  { mapPath: "/Game/Maps/Port/Port", displayName: "Icebox" },
  { mapPath: "/Game/Maps/Triad/Triad", displayName: "Haven" },
];

export function mapDisplayName(mapPath: string): string {
  return KNOWN_MAPS.find((m) => m.mapPath === mapPath)?.displayName ?? "Unknown map";
}
