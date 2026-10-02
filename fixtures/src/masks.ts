/**
 * Walkable masks for fixture generation, built from the hot-linked minimaps.
 *
 * Masks are cached in fixtures/.cache (git-ignored), never committed. Without a
 * cache and without network, generation falls back to distance-only duels.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { z } from "zod";
import { decodeMask, encodeMask, maskFromAlpha, type Mask } from "@replay-lab/shared";

const CACHE = fileURLToPath(new URL("../.cache/masks.json", import.meta.url));

/** Minimal PNG decoder for 8-bit RGBA, non-interlaced images (what the minimaps are). */
export function decodePngAlpha(png: Buffer): {
  size: number;
  alpha: (x: number, y: number) => number;
} {
  if (png.readUInt32BE(12) !== 0x49484452) throw new Error("not a PNG");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error("unsupported PNG format");
  const idat: Buffer[] = [];
  for (let off = 8; off < png.length;) {
    const len = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x] ?? 0;
      const left = x >= 4 ? (out[y * stride + x - 4] ?? 0) : 0;
      const up = y > 0 ? (out[(y - 1) * stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= 4 ? (out[(y - 1) * stride + x - 4] ?? 0) : 0;
      let pred = 0;
      if (filter === 1) pred = left;
      else if (filter === 2) pred = up;
      else if (filter === 3) pred = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out[y * stride + x] = (v + pred) & 0xff;
    }
  }
  return { size: Math.min(width, height), alpha: (x, y) => out[y * stride + x * 4 + 3] ?? 0 };
}

const MapsResponse = z.object({
  data: z.array(z.object({ mapUrl: z.string().nullish(), displayIcon: z.string().nullish() })),
});

/** Loads cached masks, fetching and caching any that are missing. */
export async function loadMasks(mapPaths: string[]): Promise<Map<string, Mask>> {
  const cached: Record<string, string> = existsSync(CACHE)
    ? (JSON.parse(readFileSync(CACHE, "utf8")) as Record<string, string>)
    : {};
  const missing = mapPaths.filter((p) => !cached[p]);
  if (missing.length) {
    try {
      const res = await fetch("https://valorant-api.com/v1/maps");
      const maps = MapsResponse.parse(await res.json()).data;
      for (const path of missing) {
        const url = maps.find((m) => m.mapUrl === path)?.displayIcon;
        if (!url) continue;
        const png = Buffer.from(await (await fetch(url)).arrayBuffer());
        const { size, alpha } = decodePngAlpha(png);
        cached[path] = encodeMask(maskFromAlpha(alpha, size));
      }
      mkdirSync(fileURLToPath(new URL("../.cache/", import.meta.url)), { recursive: true });
      writeFileSync(CACHE, JSON.stringify(cached));
    } catch (err) {
      console.warn(`Couldn't fetch minimaps (${String(err)}); duels will use distance only.`);
    }
  }
  return new Map(Object.entries(cached).map(([path, enc]) => [path, decodeMask(enc)]));
}

/** Masks from the cache only (no network); used by tests. */
export function cachedMasks(): Map<string, Mask> | undefined {
  if (!existsSync(CACHE)) return undefined;
  const cached = JSON.parse(readFileSync(CACHE, "utf8")) as Record<string, string>;
  return new Map(Object.entries(cached).map(([path, enc]) => [path, decodeMask(enc)]));
}
