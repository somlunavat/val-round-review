/**
 * Walkable footprint of a map, sampled from its minimap's opaque pixels.
 *
 * Shared by the 3D blockout (browser) and the fixture generator (Node) so that
 * sample kills only happen where the blockout shows a clear line between players.
 * Masks are computed at runtime from hot-linked images and never committed.
 */
import type { MapCalibration } from "./maps.js";
import type { Vec2 } from "./replay.js";

/** Grid resolution across the minimap. */
export const GRID = 160;

export type Mask = { size: number; cells: Uint8Array };

/** Game x/y -> normalized minimap coordinates (0..1). Game Y drives horizontal. */
export function toNormalized(cal: MapCalibration, pos: Vec2): Vec2 {
  return {
    x: pos.y * cal.xMultiplier + cal.xScalarToAdd,
    y: pos.x * cal.yMultiplier + cal.yScalarToAdd,
  };
}

/** Inverse of toNormalized. */
export function fromNormalized(cal: MapCalibration, n: Vec2): Vec2 {
  return {
    x: (n.y - cal.yScalarToAdd) / cal.yMultiplier,
    y: (n.x - cal.xScalarToAdd) / cal.xMultiplier,
  };
}

/** Marks a cell walkable when most of its pixels are opaque. */
export function maskFromAlpha(
  alpha: (x: number, y: number) => number,
  imageSize: number,
  size = GRID,
): Mask {
  const cells = new Uint8Array(size * size);
  const step = imageSize / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let opaque = 0;
      let total = 0;
      // Sample a 3×3 lattice inside the cell.
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          const x = Math.min(imageSize - 1, Math.floor((i + (sx + 0.5) / 3) * step));
          const y = Math.min(imageSize - 1, Math.floor((j + (sy + 0.5) / 3) * step));
          total++;
          if (alpha(x, y) > 96) opaque++;
        }
      }
      cells[j * size + i] = opaque / total > 0.5 ? 1 : 0;
    }
  }
  return { size, cells };
}

function cellAt(mask: Mask, cal: MapCalibration, pos: Vec2) {
  const n = toNormalized(cal, pos);
  return { i: Math.floor(n.x * mask.size), j: Math.floor(n.y * mask.size) };
}

function walkableCell(mask: Mask, i: number, j: number): boolean {
  return i >= 0 && j >= 0 && i < mask.size && j < mask.size && mask.cells[j * mask.size + i] === 1;
}

export function isWalkable(mask: Mask, cal: MapCalibration, pos: Vec2): boolean {
  const { i, j } = cellAt(mask, cal, pos);
  return walkableCell(mask, i, j);
}

/**
 * True when the straight line between two positions stays on walkable floor,
 * sampled every quarter cell. Ignores height: a 2D sight line on the footprint.
 */
export function lineOfSight(mask: Mask, cal: MapCalibration, a: Vec2, b: Vec2): boolean {
  const na = toNormalized(cal, a);
  const nb = toNormalized(cal, b);
  const cells = Math.hypot(nb.x - na.x, nb.y - na.y) * mask.size;
  const steps = Math.max(1, Math.ceil(cells * 4));
  for (let s = 0; s <= steps; s++) {
    const k = s / steps;
    const i = Math.floor((na.x + (nb.x - na.x) * k) * mask.size);
    const j = Math.floor((na.y + (nb.y - na.y) * k) * mask.size);
    if (!walkableCell(mask, i, j)) return false;
  }
  return true;
}

/** Nearest walkable cell centre (game units) to a position, searching outward. */
export function snapToWalkable(mask: Mask, cal: MapCalibration, pos: Vec2, maxRing = 8): Vec2 {
  const { i, j } = cellAt(mask, cal, pos);
  if (walkableCell(mask, i, j)) return pos;
  for (let r = 1; r <= maxRing; r++) {
    let best: { i: number; j: number; d: number } | undefined;
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !walkableCell(mask, i + di, j + dj))
          continue;
        const d = di * di + dj * dj;
        if (!best || d < best.d) best = { i: i + di, j: j + dj, d };
      }
    }
    if (best) {
      const p = fromNormalized(cal, {
        x: (best.i + 0.5) / mask.size,
        y: (best.j + 0.5) / mask.size,
      });
      return { x: Math.round(p.x), y: Math.round(p.y) };
    }
  }
  return pos;
}

/** Packs a mask as base64 (1 bit per cell) for caching. */
export function encodeMask(mask: Mask): string {
  const bytes = new Uint8Array(Math.ceil(mask.cells.length / 8));
  mask.cells.forEach((v, k) => {
    if (v) bytes[k >> 3] = (bytes[k >> 3] ?? 0) | (1 << (k & 7));
  });
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeMask(encoded: string, size = GRID): Mask {
  const bin = atob(encoded);
  const cells = new Uint8Array(size * size);
  for (let k = 0; k < cells.length; k++) cells[k] = (bin.charCodeAt(k >> 3) >> (k & 7)) & 1;
  return { size, cells };
}
