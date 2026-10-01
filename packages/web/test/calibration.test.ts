import { describe, expect, it } from "vitest";
import { MAP_DATA, mapData } from "@replay-lab/shared";
import { fromNormalized, toNormalized, toPixel } from "../src/maps/calibration.js";

const ascent = mapData("/Game/Maps/Ascent/Ascent");
if (!ascent) throw new Error("Ascent map data missing");

const callout = (region: string, name: string) => {
  const c = ascent.callouts.find((x) => x.region === region && x.name === name);
  if (!c) throw new Error(`no callout ${region} ${name}`);
  return c.pos;
};

describe("Ascent calibration (known points)", () => {
  // Hand-computed from the published constants (axis swap: game y -> pixel x).
  // Also checked by eye: these land on A Site and B Site in the official minimap.
  it("maps A Site to the expected pixel", () => {
    const p = toPixel(ascent, callout("A", "Site"), 1000);
    expect(p.x).toBeCloseTo(350.1, 0);
    expect(p.y).toBeCloseTo(142.5, 0);
  });

  it("maps B Site to the expected pixel", () => {
    const p = toPixel(ascent, callout("B", "Site"), 1000);
    expect(p.x).toBeCloseTo(285.5, 0);
    expect(p.y).toBeCloseTo(737.3, 0);
  });
});

describe.each(MAP_DATA.map((m) => [m.displayName, m] as const))("%s calibration", (_name, map) => {
  it("puts every callout inside the image", () => {
    for (const c of map.callouts) {
      const n = toNormalized(map, c.pos);
      expect(n.x, `${c.region} ${c.name}`).toBeGreaterThan(0);
      expect(n.x, `${c.region} ${c.name}`).toBeLessThan(1);
      expect(n.y, `${c.region} ${c.name}`).toBeGreaterThan(0);
      expect(n.y, `${c.region} ${c.name}`).toBeLessThan(1);
    }
  });

  it("keeps attacker and defender spawns apart", () => {
    const spawn = (side: string) =>
      map.callouts.find((c) => c.name === "Spawn" && c.region.startsWith(side));
    const atk = spawn("Attacker");
    const def = spawn("Defender");
    if (!atk || !def) return;
    const a = toNormalized(map, atk.pos);
    const d = toNormalized(map, def.pos);
    expect(Math.hypot(a.x - d.x, a.y - d.y)).toBeGreaterThan(0.25);
  });

  it("round-trips through fromNormalized", () => {
    const pos = { x: 1234, y: -5678 };
    const back = fromNormalized(map, toNormalized(map, pos));
    expect(back.x).toBeCloseTo(pos.x, 6);
    expect(back.y).toBeCloseTo(pos.y, 6);
  });
});
