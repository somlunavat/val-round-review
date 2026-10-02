import { useEffect, useState } from "react";
import type { MapData } from "@replay-lab/shared";
import { buildBlockout, tonesFromImage, type Blockout } from "./blockout.js";

type Ready = { status: "ready"; blockout: Blockout; image: HTMLImageElement };
type State = { status: "loading" } | { status: "error"; message: string } | Ready;

const cache = new Map<string, Ready>();

/** Loads the minimap, samples its footprint and tones, and builds the blockout once per map. */
export function useBlockout(map: MapData, minimapUrl: string | undefined): State {
  // Only async results are kept in state; cache hits and missing URLs are derived.
  const [failed, setFailed] = useState<{ key: string; message: string }>();
  const [, setBuilt] = useState(0);
  const key = `${map.mapPath}|${minimapUrl ?? ""}`;
  const cached = cache.get(map.mapPath);

  useEffect(() => {
    if (cache.has(map.mapPath) || !minimapUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = Math.min(img.naturalWidth, img.naturalHeight, 1024);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const { mask, tones } = tonesFromImage((x, y) => {
          const o = (y * size + x) * 4;
          return [data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0, data[o + 3] ?? 0] as const;
        }, size);
        cache.set(map.mapPath, {
          status: "ready",
          blockout: buildBlockout(map, mask, tones),
          image: img,
        });
        setBuilt((n) => n + 1);
      } catch {
        setFailed({ key, message: "Couldn't read the minimap to build the 3D view." });
      }
    };
    img.onerror = () => {
      if (!cancelled) setFailed({ key, message: "Couldn't load the minimap for the 3D view." });
    };
    img.src = minimapUrl;
    return () => {
      cancelled = true;
    };
  }, [map, minimapUrl, key]);

  if (cached) return cached;
  if (!minimapUrl) {
    return {
      status: "error",
      message: "The 3D blockout is generated from the minimap, which couldn't be loaded.",
    };
  }
  if (failed?.key === key) return { status: "error", message: failed.message };
  return { status: "loading" };
}
