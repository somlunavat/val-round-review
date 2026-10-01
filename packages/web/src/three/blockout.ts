/**
 * Procedural low-poly blockout for any map.
 *
 * The walkable footprint comes from the minimap's opaque pixels (sampled at
 * runtime, never stored). Floor heights come from callout points' z values,
 * blended by inverse distance and snapped to terraces. Walls go wherever a
 * walkable cell meets empty space. The result is our own simplified geometry:
 * it gets lanes and sites roughly right and is approximate everywhere else.
 */
import type { MapData, Vec2 } from "@replay-lab/shared";
import { toNormalized } from "../maps/calibration.js";

/** Grid resolution across the minimap. */
export const GRID = 160;
/** Scene units across the whole minimap (x and z span 0..SCENE). */
export const SCENE = 100;
/** Height snapping step, in game units. */
const TERRACE = 75;
/** Wall height above the floor, in game units. */
export const WALL_HEIGHT = 450;

export type Mask = { size: number; cells: Uint8Array };

export type Rect = {
  /** Grid cell range [i0, i1) × [j0, j1); i is horizontal (u), j vertical (v). */
  i0: number;
  i1: number;
  j0: number;
  j1: number;
  /** Floor top, game units. */
  height: number;
};

export type Wall = {
  /** Wall runs along a cell edge from (a) to (b) in grid coordinates. */
  a: { i: number; j: number };
  b: { i: number; j: number };
  /** Floor height the wall stands on, game units. */
  base: number;
};

export type Blockout = {
  mapPath: string;
  size: number;
  floors: Rect[];
  walls: Wall[];
  heights: Float32Array; // per cell, NaN where not walkable
  minHeight: number;
  maxHeight: number;
  /** Scene units per game unit (horizontal and vertical use the same scale). */
  unit: number;
};

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

/** Floor height (game units) at a normalized point, from nearby callout heights. */
export function heightField(map: MapData): (u: number, v: number) => number {
  const points = map.callouts.map((c) => ({ ...toNormalized(map, c.pos), z: c.pos.z }));
  if (points.length === 0) return () => 0;
  return (u, v) => {
    const near = points
      .map((p) => ({ z: p.z, d2: (p.x - u) ** 2 + (p.y - v) ** 2 }))
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, 4);
    const first = near[0];
    if (first && first.d2 < 1e-9) return first.z;
    let num = 0;
    let den = 0;
    for (const p of near) {
      const w = 1 / p.d2;
      num += w * p.z;
      den += w;
    }
    return den ? num / den : 0;
  };
}

/** Greedy rectangles over cells that share a height. */
export function greedyRects(mask: Mask, heights: Float32Array): Rect[] {
  const { size, cells } = mask;
  const used = new Uint8Array(size * size);
  const rects: Rect[] = [];
  const at = (i: number, j: number) => j * size + i;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = at(i, j);
      if (!cells[k] || used[k]) continue;
      const h = heights[k] ?? 0;
      let i1 = i + 1;
      while (i1 < size && cells[at(i1, j)] && !used[at(i1, j)] && heights[at(i1, j)] === h) i1++;
      let j1 = j + 1;
      grow: while (j1 < size) {
        for (let x = i; x < i1; x++) {
          const kk = at(x, j1);
          if (!cells[kk] || used[kk] || heights[kk] !== h) break grow;
        }
        j1++;
      }
      for (let y = j; y < j1; y++) for (let x = i; x < i1; x++) used[at(x, y)] = 1;
      rects.push({ i0: i, i1, j0: j, j1, height: h });
    }
  }
  return rects;
}

/** Wall segments on every walkable/empty boundary, merged into straight runs. */
export function boundaryWalls(mask: Mask, heights: Float32Array): Wall[] {
  const { size, cells } = mask;
  const walkable = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < size && j < size && cells[j * size + i] === 1;
  const h = (i: number, j: number) => heights[j * size + i] ?? 0;
  const walls: Wall[] = [];

  // Horizontal edges (between rows j-1 and j), scanned along i.
  for (let j = 0; j <= size; j++) {
    let run: Wall | undefined;
    for (let i = 0; i <= size; i++) {
      const above = walkable(i, j - 1);
      const below = walkable(i, j);
      const edge = i < size && above !== below;
      const base = edge ? (above ? h(i, j - 1) : h(i, j)) : 0;
      if (edge && run && run.base === base && run.b.i === i) {
        run.b = { i: i + 1, j };
      } else {
        if (run) walls.push(run);
        run = edge ? { a: { i, j }, b: { i: i + 1, j }, base } : undefined;
      }
    }
    if (run) walls.push(run);
  }

  // Vertical edges (between columns i-1 and i), scanned along j.
  for (let i = 0; i <= size; i++) {
    let run: Wall | undefined;
    for (let j = 0; j <= size; j++) {
      const left = walkable(i - 1, j);
      const right = walkable(i, j);
      const edge = j < size && left !== right;
      const base = edge ? (left ? h(i - 1, j) : h(i, j)) : 0;
      if (edge && run && run.base === base && run.b.j === j) {
        run.b = { i, j: j + 1 };
      } else {
        if (run) walls.push(run);
        run = edge ? { a: { i, j }, b: { i, j: j + 1 }, base } : undefined;
      }
    }
    if (run) walls.push(run);
  }
  return walls;
}

export function buildBlockout(map: MapData, mask: Mask): Blockout {
  const { size, cells } = mask;
  const field = heightField(map);
  const heights = new Float32Array(size * size).fill(Number.NaN);
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      if (!cells[k]) continue;
      const z = Math.round(field((i + 0.5) / size, (j + 0.5) / size) / TERRACE) * TERRACE;
      heights[k] = z;
      minHeight = Math.min(minHeight, z);
      maxHeight = Math.max(maxHeight, z);
    }
  }
  if (!Number.isFinite(minHeight)) {
    minHeight = 0;
    maxHeight = 0;
  }
  return {
    mapPath: map.mapPath,
    size,
    floors: greedyRects(mask, heights),
    walls: boundaryWalls(mask, heights),
    heights,
    minHeight,
    maxHeight,
    unit: SCENE * Math.abs(map.xMultiplier),
  };
}

/** Converts between game coordinates and the 3D scene. Height is scene Y. */
export type SceneMapping = {
  toScene: (pos: Vec2) => { x: number; z: number };
  /** Blockout floor height (scene Y) under a game position. */
  floorAt: (pos: Vec2) => number;
  /** Scene units per game unit. */
  unit: number;
  center: { x: number; z: number };
};

export function sceneMapping(map: MapData, blockout: Blockout): SceneMapping {
  const field = heightField(map);
  const { size, heights, unit, minHeight } = blockout;
  return {
    unit,
    center: { x: SCENE / 2, z: SCENE / 2 },
    toScene: (pos) => {
      const n = toNormalized(map, pos);
      return { x: n.x * SCENE, z: n.y * SCENE };
    },
    floorAt: (pos) => {
      const n = toNormalized(map, pos);
      const i = Math.floor(n.x * size);
      const j = Math.floor(n.y * size);
      const h = i >= 0 && j >= 0 && i < size && j < size ? heights[j * size + i] : Number.NaN;
      // Off the footprint (approximate data or a thin lane we missed): fall back to the field.
      const z = h !== undefined && !Number.isNaN(h) ? h : field(n.x, n.y);
      return (z - minHeight) * unit;
    },
  };
}

/**
 * Moves a scene point (x, z) onto open floor: into the nearest walkable cell,
 * and away from any edge of that cell that borders a wall. Used for POV eyes,
 * since approximate positions can land inside a blockout wall.
 */
export function clearOfWalls(blockout: Pick<Blockout, "size" | "heights">, x: number, z: number) {
  const { size, heights } = blockout;
  const cell = SCENE / size;
  const walkable = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < size && j < size && !Number.isNaN(heights[j * size + i] ?? Number.NaN);
  let i = Math.floor(x / cell);
  let j = Math.floor(z / cell);
  if (!walkable(i, j)) {
    let best: { i: number; j: number; d: number } | undefined;
    for (let r = 1; r <= 6 && !best; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !walkable(i + di, j + dj)) continue;
          const d = di * di + dj * dj;
          if (!best || d < best.d) best = { i: i + di, j: j + dj, d };
        }
      }
    }
    if (!best) return { x, z };
    i = best.i;
    j = best.j;
  }
  const margin = cell * 0.5;
  const minX = i * cell + (walkable(i - 1, j) ? 0 : margin);
  const maxX = (i + 1) * cell - (walkable(i + 1, j) ? 0 : margin);
  const minZ = j * cell + (walkable(i, j - 1) ? 0 : margin);
  const maxZ = (j + 1) * cell - (walkable(i, j + 1) ? 0 : margin);
  return { x: Math.min(maxX, Math.max(minX, x)), z: Math.min(maxZ, Math.max(minZ, z)) };
}
