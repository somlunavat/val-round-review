/**
 * Procedural low-poly blockout for any map.
 *
 * The walkable footprint comes from the minimap's opaque pixels (sampled at
 * runtime, never stored). The minimap's grey tones mark local detail: base
 * floor, low cover (boxes, pillars, small platforms), and high ground. Floor
 * height is a regional base blended from callout z values, plus a lift for low
 * cover and high ground. Walls go wherever a walkable cell meets empty space.
 * The result is our own simplified geometry: approximate, but shaped by each map.
 */
import {
  GRID,
  maskFromAlpha,
  toNormalized,
  type MapData,
  type Mask,
  type Vec2,
} from "@replay-lab/shared";

export { GRID, maskFromAlpha, type Mask };

/** Scene units across the whole minimap (x and z span 0..SCENE). */
export const SCENE = 100;
/** Height snapping step for the regional base, in game units. */
const TERRACE = 75;
/** Grid resolution for the 3D blockout (finer than the sight-line mask). */
export const GRID_3D = 256;

/** Minimap tone per cell: 0 empty, 1 floor, 2 low cover, 3 high ground. */
export type Tone = 0 | 1 | 2 | 3;
/** Lift above the regional base for each tone, in game units. */
export const TONE_LIFT: Record<Tone, number> = { 0: 0, 1: 0, 2: 110, 3: 230 };

/** Classifies one minimap pixel; undefined for outlines/edges that shouldn't vote. */
export function pixelTone(r: number, g: number, b: number): Tone | undefined {
  if (r - b > 20) return 1; // yellow plant-site tint sits on floor level
  if (r >= 225) return undefined; // white wall outline
  if (r >= 150) return undefined; // light ledge edge
  if (r >= 136) return 3;
  if (r >= 120) return 2;
  return 1;
}

/**
 * Walkable mask plus a tone per cell, sampled on a 4×4 lattice per cell.
 * `rgba(x, y)` returns the pixel as [r, g, b, a].
 */
export function tonesFromImage(
  rgba: (x: number, y: number) => readonly [number, number, number, number],
  imageSize: number,
  size = GRID_3D,
): { mask: Mask; tones: Uint8Array } {
  const cells = new Uint8Array(size * size);
  const tones = new Uint8Array(size * size);
  const step = imageSize / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let opaque = 0;
      const votes = [0, 0, 0, 0];
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const x = Math.min(imageSize - 1, Math.floor((i + (sx + 0.5) / 4) * step));
          const y = Math.min(imageSize - 1, Math.floor((j + (sy + 0.5) / 4) * step));
          const [r, g, b, a] = rgba(x, y);
          if (a <= 96) continue;
          opaque++;
          const t = pixelTone(r, g, b);
          if (t !== undefined) votes[t] = (votes[t] ?? 0) + 1;
        }
      }
      const k = j * size + i;
      if (opaque / 16 <= 0.5) continue;
      cells[k] = 1;
      const best = ([1, 2, 3] as const).reduce(
        (a, t) => ((votes[t] ?? 0) > (votes[a] ?? 0) ? t : a),
        1 as Tone,
      );
      tones[k] = best;
    }
  }
  return { mask: { size, cells }, tones };
}
/** Wall height above the floor, in game units. */
export const WALL_HEIGHT = 450;

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

export function buildBlockout(map: MapData, mask: Mask, tones?: Uint8Array): Blockout {
  const { size, cells } = mask;
  // With tones, the regional base comes from callouts standing on base floor, so
  // high-ground callouts don't raise the floor around them twice.
  const field = heightField(tones ? floorCallouts(map, size, tones) : map);
  const heights = new Float32Array(size * size).fill(Number.NaN);
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      if (!cells[k]) continue;
      const base = Math.round(field((i + 0.5) / size, (j + 0.5) / size) / TERRACE) * TERRACE;
      const z = base + TONE_LIFT[(tones?.[k] ?? 1) as Tone];
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

/** The map with only callouts whose cell is base floor (if enough of them exist). */
function floorCallouts(map: MapData, size: number, tones: Uint8Array): MapData {
  const onFloor = map.callouts.filter((c) => {
    const n = toNormalized(map, c.pos);
    const k = Math.floor(n.y * size) * size + Math.floor(n.x * size);
    return tones[k] === 1;
  });
  return onFloor.length >= 4 ? { ...map, callouts: onFloor } : map;
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
