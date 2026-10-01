import { useEffect, useRef } from "react";
import { drawMinimap, type MinimapScene } from "./drawMinimap.js";

type Props = Omit<MinimapScene, "size"> & { size?: number };

export function Minimap2D({ size = 640, ...scene }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMinimap(ctx, { ...scene, size });
  });

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className="max-w-full rounded-lg border border-neutral-800"
      aria-label="Minimap with player positions"
    />
  );
}
