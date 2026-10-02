import type { MapCalibration, Vec2 } from "@replay-lab/shared";
import { fromNormalized, toNormalized } from "@replay-lab/shared";

export { fromNormalized, toNormalized };

/** Game coordinates -> pixels on a square image of `size` px. */
export function toPixel(cal: MapCalibration, pos: Vec2, size: number): Vec2 {
  const n = toNormalized(cal, pos);
  return { x: n.x * size, y: n.y * size };
}

/** Game units per normalized unit (the image spans this many game units). */
export function gameUnitsPerImage(cal: MapCalibration): number {
  return 1 / Math.abs(cal.xMultiplier);
}
