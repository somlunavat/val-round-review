import type { RoundEvent, Snapshot, TeamSide, Vec2 } from "@replay-lab/shared";
import { fromNormalized, toPixel } from "../maps/calibration.js";
import type { MapConfig } from "../maps/index.js";

export const COLORS = {
  ally: "#2dd4bf",
  enemy: "#f87171",
  self: "#ffffff",
  spike: "#facc15",
  grid: "rgba(148, 163, 184, 0.25)",
  gridLabel: "rgba(148, 163, 184, 0.8)",
  callout: "rgba(203, 213, 225, 0.45)",
  background: "#0b0f14",
};

export type MinimapScene = {
  map: MapConfig;
  size: number;
  snapshot: Snapshot | undefined;
  /** True when the scrubber is past the snapshot's time (positions are older than `t`). */
  stale: boolean;
  kills: Extract<RoundEvent, { type: "kill" }>[];
  plant: Extract<RoundEvent, { type: "plant" }> | undefined;
  selfPuuid: string;
  selfTeam: TeamSide | undefined;
  labels: ReadonlyMap<string, string>;
  showCalibration: boolean;
};

export function drawMinimap(ctx: CanvasRenderingContext2D, scene: MinimapScene) {
  const { map, size } = scene;
  const px = (pos: Vec2) => toPixel(map.calibration, pos, size);

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, size, size);

  drawCallouts(ctx, scene, px);
  if (scene.showCalibration) drawCalibrationGrid(ctx, scene, px);

  if (scene.plant?.pos) drawSpike(ctx, px(scene.plant.pos));

  const snap = scene.snapshot;
  if (!snap) return;

  ctx.globalAlpha = scene.stale ? 0.55 : 1;
  for (const k of scene.kills) {
    const killer = k.killer ? snap.players.find((p) => p.puuid === k.killer) : undefined;
    if (!killer) continue;
    const from = px(killer.pos);
    const to = px(k.victimPos);
    ctx.strokeStyle = colorFor(killer.team, scene.selfTeam);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  for (const p of snap.players) {
    const at = px(p.pos);
    const color = colorFor(p.team, scene.selfTeam);
    if (p.alive) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(at.x, at.y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (p.puuid === scene.selfPuuid) {
        ctx.strokeStyle = COLORS.self;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      drawCross(ctx, at, color);
    }
    ctx.fillStyle = COLORS.self;
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillText(scene.labels.get(p.puuid) ?? "?", at.x, at.y - 11);
  }
  ctx.globalAlpha = 1;
}

function colorFor(team: TeamSide, selfTeam: TeamSide | undefined) {
  return team === selfTeam ? COLORS.ally : COLORS.enemy;
}

function drawCross(ctx: CanvasRenderingContext2D, at: Vec2, color: string) {
  const r = 6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(at.x - r, at.y - r);
  ctx.lineTo(at.x + r, at.y + r);
  ctx.moveTo(at.x + r, at.y - r);
  ctx.lineTo(at.x - r, at.y + r);
  ctx.stroke();
}

function drawSpike(ctx: CanvasRenderingContext2D, at: Vec2) {
  const r = 8;
  ctx.fillStyle = COLORS.spike;
  ctx.beginPath();
  ctx.moveTo(at.x, at.y - r);
  ctx.lineTo(at.x + r, at.y);
  ctx.lineTo(at.x, at.y + r);
  ctx.lineTo(at.x - r, at.y);
  ctx.closePath();
  ctx.fill();
}

function drawCallouts(ctx: CanvasRenderingContext2D, scene: MinimapScene, px: (p: Vec2) => Vec2) {
  ctx.fillStyle = COLORS.callout;
  ctx.font = "10px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  for (const c of scene.map.callouts) {
    const at = px(c.pos);
    const name = c.name === "Site" || c.name === "Spawn" ? `${c.region} ${c.name}` : c.name;
    ctx.fillText(name, at.x, at.y + 4);
  }
}

/** Lines of constant game X and game Y every 1000 units, plus callout reference points. */
function drawCalibrationGrid(
  ctx: CanvasRenderingContext2D,
  scene: MinimapScene,
  px: (p: Vec2) => Vec2,
) {
  const { size, map } = scene;
  const cal = map.calibration;
  const corners = [fromNormalized(cal, { x: 0, y: 0 }), fromNormalized(cal, { x: 1, y: 1 })];
  const xs = corners.map((c) => c.x).sort((a, b) => a - b);
  const ys = corners.map((c) => c.y).sort((a, b) => a - b);
  const step = 1000;

  ctx.strokeStyle = COLORS.grid;
  ctx.fillStyle = COLORS.gridLabel;
  ctx.lineWidth = 1;
  ctx.font = "9px ui-monospace, monospace";

  for (let gx = Math.ceil((xs[0] ?? 0) / step) * step; gx <= (xs[1] ?? 0); gx += step) {
    // Constant game X is a horizontal line (game X drives pixel Y).
    const y = px({ x: gx, y: 0 }).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillText(`x=${gx}`, 2, y - 2);
  }
  for (let gy = Math.ceil((ys[0] ?? 0) / step) * step; gy <= (ys[1] ?? 0); gy += step) {
    const x = px({ x: 0, y: gy }).x;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
    ctx.save();
    ctx.translate(x + 2, size - 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "left";
    ctx.fillText(`y=${gy}`, 0, 0);
    ctx.restore();
  }

  ctx.strokeStyle = COLORS.spike;
  for (const c of map.callouts) {
    const at = px(c.pos);
    ctx.beginPath();
    ctx.moveTo(at.x - 4, at.y);
    ctx.lineTo(at.x + 4, at.y);
    ctx.moveTo(at.x, at.y - 4);
    ctx.lineTo(at.x, at.y + 4);
    ctx.stroke();
  }
}
