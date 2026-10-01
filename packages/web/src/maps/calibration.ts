import type { Vec2 } from "@replay-lab/shared";
import type { MapCalibration } from "./types.js";

/** Game coordinates -> normalized minimap coordinates (0..1 inside the image). */
export function toNormalized(cal: MapCalibration, pos: Vec2): Vec2 {
  return {
    x: pos.y * cal.xMultiplier + cal.xScalarToAdd,
    y: pos.x * cal.yMultiplier + cal.yScalarToAdd,
  };
}

/** Game coordinates -> pixels on a square canvas of `size` px. */
export function toPixel(cal: MapCalibration, pos: Vec2, size = cal.imageSize): Vec2 {
  const n = toNormalized(cal, pos);
  return { x: n.x * size, y: n.y * size };
}

/** Inverse of toNormalized; used by the debug grid to label lines in game units. */
export function fromNormalized(cal: MapCalibration, n: Vec2): Vec2 {
  return {
    x: (n.y - cal.yScalarToAdd) / cal.yMultiplier,
    y: (n.x - cal.xScalarToAdd) / cal.xMultiplier,
  };
}
