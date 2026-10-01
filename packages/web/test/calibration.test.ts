import { describe, expect, it } from "vitest";
import { ascent } from "../src/maps/ascent.js";
import { fromNormalized, toNormalized, toPixel } from "../src/maps/calibration.js";

const cal = ascent.calibration;
const callout = (region: string, name: string) => {
  const c = ascent.callouts.find((x) => x.region === region && x.name === name);
  if (!c) throw new Error(`no callout ${region} ${name}`);
  return c.pos;
};

describe("Ascent calibration", () => {
  // Hand-computed from the published constants (axis swap: game y -> pixel x).
  it("maps A Site to the expected pixel", () => {
    const p = toPixel(cal, callout("A", "Site"), 1000);
    expect(p.x).toBeCloseTo((-6626 * 0.00007 + 0.813895) * 1000, 6); // ≈ 350.1
    expect(p.y).toBeCloseTo((6154 * -0.00007 + 0.573242) * 1000, 6); // ≈ 142.5
  });

  it("maps B Site to the expected pixel", () => {
    const p = toPixel(cal, callout("B", "Site"), 1000);
    expect(p.x).toBeCloseTo(285.5, 0);
    expect(p.y).toBeCloseTo(737.3, 0);
  });

  it("puts every callout inside the image", () => {
    for (const c of ascent.callouts) {
      const n = toNormalized(cal, c.pos);
      expect(n.x, c.name).toBeGreaterThan(0);
      expect(n.x, c.name).toBeLessThan(1);
      expect(n.y, c.name).toBeGreaterThan(0);
      expect(n.y, c.name).toBeLessThan(1);
    }
  });

  it("keeps A and B on opposite halves and spawns on opposite sides", () => {
    expect(toNormalized(cal, callout("A", "Site")).y).toBeLessThan(0.5);
    expect(toNormalized(cal, callout("B", "Site")).y).toBeGreaterThan(0.5);
    const atk = toNormalized(cal, callout("Attacker Side", "Spawn"));
    const def = toNormalized(cal, callout("Defender Side", "Spawn"));
    expect(Math.sign(atk.x - 0.5)).not.toBe(Math.sign(def.x - 0.5));
  });

  it("round-trips through fromNormalized", () => {
    const pos = { x: 1234, y: -5678 };
    const back = fromNormalized(cal, toNormalized(cal, pos));
    expect(back.x).toBeCloseTo(pos.x, 6);
    expect(back.y).toBeCloseTo(pos.y, 6);
  });
});
