import { describe, expect, it } from "vitest";
import { mapData, type MapData } from "@replay-lab/shared";
import {
  boundaryWalls,
  buildBlockout,
  clearOfWalls,
  SCENE,
  greedyRects,
  heightField,
  maskFromAlpha,
  sceneMapping,
  type Mask,
} from "../src/three/blockout.js";
import { toNormalized } from "../src/maps/calibration.js";

function mask(rows: string[]): Mask {
  const size = rows.length;
  const cells = new Uint8Array(size * size);
  rows.forEach((row, j) => [...row].forEach((c, i) => (cells[j * size + i] = c === "#" ? 1 : 0)));
  return { size, cells };
}

const flat = (m: Mask, h = 0) => new Float32Array(m.size * m.size).fill(h);

describe("maskFromAlpha", () => {
  it("marks cells walkable where most pixels are opaque", () => {
    // Left half opaque, right half transparent.
    const m = maskFromAlpha((x) => (x < 50 ? 255 : 0), 100, 4);
    expect([...m.cells]).toEqual([1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0]);
  });
});

describe("greedyRects", () => {
  it("covers a solid block with one rectangle", () => {
    const m = mask(["###", "###", "###"]);
    expect(greedyRects(m, flat(m))).toEqual([{ i0: 0, i1: 3, j0: 0, j1: 3, height: 0 }]);
  });

  it("splits by height and skips empty cells", () => {
    const m = mask(["##.", "##.", "..."]);
    const h = flat(m);
    h[1] = 100; // cell (1,0) higher
    const rects = greedyRects(m, h);
    const covered = rects.reduce((n, r) => n + (r.i1 - r.i0) * (r.j1 - r.j0), 0);
    expect(covered).toBe(4);
    expect(rects.some((r) => r.height === 100 && r.i0 === 1 && r.j0 === 0)).toBe(true);
  });
});

describe("boundaryWalls", () => {
  it("encloses a single cell with four unit walls", () => {
    const m = mask(["...", ".#.", "..."]);
    const walls = boundaryWalls(m, flat(m));
    expect(walls).toHaveLength(4);
  });

  it("merges straight edges into one run", () => {
    const m = mask(["####", "####", "....", "...."]);
    const walls = boundaryWalls(m, flat(m));
    // Top, bottom, left, right of a 4×2 block.
    expect(walls).toHaveLength(4);
    const bottom = walls.find((w) => w.a.j === 2 && w.b.j === 2);
    expect(bottom).toMatchObject({ a: { i: 0 }, b: { i: 4 } });
  });
});

const ascent = mapData("/Game/Maps/Ascent/Ascent") as MapData;

describe("heights", () => {
  it("returns a callout's own height at its position", () => {
    const window = ascent.callouts.find((c) => c.name === "Window");
    if (!window) throw new Error("no Window callout");
    const n = toNormalized(ascent, window.pos);
    expect(heightField(ascent)(n.x, n.y)).toBeCloseTo(window.pos.z, 3);
  });

  it("snaps players to the blockout floor", () => {
    const m: Mask = { size: 32, cells: new Uint8Array(32 * 32).fill(1) };
    const b = buildBlockout(ascent, m);
    const s = sceneMapping(ascent, b);
    const site = ascent.callouts.find((c) => c.region === "A" && c.name === "Site");
    if (!site) throw new Error("no A Site");
    const y = s.floorAt(site.pos);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual((b.maxHeight - b.minHeight) * b.unit + 1e-9);
  });
});

describe("clearOfWalls", () => {
  // 4×4 grid, only the centre 2×2 walkable.
  const size = 4;
  const heights = new Float32Array(size * size).fill(Number.NaN);
  for (const k of [5, 6, 9, 10]) heights[k] = 0;
  const cell = SCENE / size;

  it("moves a point from a wall cell into open floor", () => {
    const p = clearOfWalls({ size, heights }, 0.1 * cell, 0.1 * cell);
    expect(p.x).toBeGreaterThan(cell);
    expect(p.z).toBeGreaterThan(cell);
  });

  it("keeps points off the edge that borders a wall", () => {
    const p = clearOfWalls({ size, heights }, 1.01 * cell, 1.5 * cell);
    expect(p.x).toBeGreaterThanOrEqual(1.5 * cell - 1e-9);
  });

  it("leaves open-floor points alone", () => {
    expect(clearOfWalls({ size, heights }, 2 * cell, 2 * cell)).toEqual({
      x: 2 * cell,
      z: 2 * cell,
    });
  });
});
