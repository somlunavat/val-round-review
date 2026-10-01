import { useState } from "react";
import type { RoundEvent, Snapshot, SnapshotPlayer, TeamSide, Vec2 } from "@replay-lab/shared";
import type { ContentLookup } from "../content/lookup.js";
import { fromNormalized, toNormalized } from "../maps/calibration.js";
import type { MapConfig } from "../maps/index.js";

const VIEW = 1000;
/** Markers are drawn at this scale so they stay readable when the map renders small. */
const MARKER_SCALE = 1.4;

type KillEvent = Extract<RoundEvent, { type: "kill" }>;

export type MapViewProps = {
  map: MapConfig;
  minimapUrl: string | undefined;
  snapshot: Snapshot | undefined;
  /** True when the playhead is past the snapshot (positions are older than now). */
  stale: boolean;
  kills: KillEvent[];
  plant: Extract<RoundEvent, { type: "plant" }> | undefined;
  defused: boolean;
  selfTeam: TeamSide | undefined;
  selfPuuid: string;
  agentOf: (puuid: string) => string | undefined;
  labelOf: (puuid: string) => string;
  lookup: ContentLookup;
  showCallouts: boolean;
  showCalibration: boolean;
};

export function MapView(props: MapViewProps) {
  const { map, snapshot, stale, selfTeam } = props;
  const [imageFailed, setImageFailed] = useState(false);
  const px = (pos: Vec2) => {
    const n = toNormalized(map.calibration, pos);
    return { x: n.x * VIEW, y: n.y * VIEW };
  };
  const teamColor = (team: TeamSide) =>
    team === selfTeam ? "var(--color-ally)" : "var(--color-enemy)";
  const showImage = props.minimapUrl && !imageFailed;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className="h-full w-full select-none"
      role="img"
      aria-label={`${map.calibration.displayName} minimap with player positions`}
    >
      <defs>
        <radialGradient id="map-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="#0b0e13" stopOpacity="0" />
          <stop offset="100%" stopColor="#0b0e13" stopOpacity="0.8" />
        </radialGradient>
        <marker
          id="arrow-ally"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" fill="var(--color-ally)" />
        </marker>
        <marker
          id="arrow-enemy"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" fill="var(--color-enemy)" />
        </marker>
        <clipPath id="avatar-clip">
          <circle r="15" />
        </clipPath>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width={VIEW} height={VIEW} fill="#0d1218" />
      {showImage ? (
        <image
          href={props.minimapUrl}
          width={VIEW}
          height={VIEW}
          opacity={0.9}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <FallbackGrid />
      )}
      <rect width={VIEW} height={VIEW} fill="url(#map-vignette)" />

      {props.showCallouts &&
        map.callouts.map((c) => {
          const at = px(c.pos);
          const name =
            c.name === "Site"
              ? `${c.region} Site`
              : c.name === "Spawn"
                ? `${c.region.split(" ")[0]} Spawn`
                : c.name;
          return (
            <text
              key={`${c.region}-${c.name}`}
              x={at.x}
              y={at.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white/50 font-display text-[19px] font-semibold uppercase tracking-wider"
              style={{
                paintOrder: "stroke",
                stroke: "#0b0e13",
                strokeWidth: 4,
                strokeOpacity: 0.6,
              }}
            >
              {name}
            </text>
          );
        })}

      {props.showCalibration && <CalibrationGrid map={map} px={px} />}

      {props.plant?.pos && <SpikeMarker at={px(props.plant.pos)} active={!props.defused} />}

      {snapshot && (
        <g opacity={stale ? 0.5 : 1} style={{ transition: "opacity 200ms" }}>
          {props.kills.map((k) => {
            const killer = k.killer
              ? snapshot.players.find((p) => p.puuid === k.killer)
              : undefined;
            if (!killer) return null;
            return (
              <KillLine
                key={`${k.t}-${k.victim}`}
                from={px(killer.pos)}
                to={px(k.victimPos)}
                ally={killer.team === selfTeam}
                weaponIcon={props.lookup.weapon(k.weapon)?.icon}
              />
            );
          })}
          {(() => {
            const labelY = stackLabels(
              snapshot.players.map((p) => ({ id: p.puuid, at: px(p.pos) })),
            );
            return (
              [...snapshot.players]
                // Paint order: dead, then living, then the viewer on top so they're never hidden.
                .sort((a, b) => layer(a, props.selfPuuid) - layer(b, props.selfPuuid))
                .map((p) => (
                  <PlayerMarker
                    key={p.puuid}
                    player={p}
                    at={px(p.pos)}
                    color={teamColor(p.team)}
                    isSelf={p.puuid === props.selfPuuid}
                    label={props.labelOf(p.puuid)}
                    icon={props.lookup.agent(props.agentOf(p.puuid))?.icon}
                    labelOffset={labelY.get(p.puuid) ?? 32}
                  />
                ))
            );
          })()}
        </g>
      )}
    </svg>
  );
}

/**
 * Vertical label offsets so name pills of nearby players don't overlap:
 * each label drops below any earlier label it would collide with.
 */
function stackLabels(markers: { id: string; at: Vec2 }[]): Map<string, number> {
  const placed: { x: number; y: number }[] = [];
  const out = new Map<string, number>();
  for (const m of [...markers].sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)) {
    let offset = 32;
    while (
      placed.some(
        (p) =>
          Math.abs(p.x - m.at.x) < 90 * MARKER_SCALE &&
          Math.abs(p.y - (m.at.y + offset * MARKER_SCALE)) < 24 * MARKER_SCALE,
      )
    ) {
      offset += 24;
    }
    placed.push({ x: m.at.x, y: m.at.y + offset * MARKER_SCALE });
    out.set(m.id, offset);
  }
  return out;
}

function layer(p: SnapshotPlayer, selfPuuid: string): number {
  return (p.alive ? 1 : 0) + (p.puuid === selfPuuid ? 2 : 0);
}

function PlayerMarker({
  player,
  at,
  color,
  isSelf,
  label,
  icon,
  labelOffset,
}: {
  player: SnapshotPlayer;
  at: Vec2;
  color: string;
  isSelf: boolean;
  label: string;
  icon: string | undefined;
  labelOffset: number;
}) {
  const dead = !player.alive;
  return (
    <g transform={`translate(${at.x} ${at.y}) scale(${MARKER_SCALE})`} opacity={dead ? 0.75 : 1}>
      <title>{`${label}${dead ? " (dead)" : ""}`}</title>
      {isSelf && !dead && <circle r="25" fill="none" stroke="white" strokeWidth="3" />}
      <circle r="18" fill="#0b0e13" stroke={color} strokeWidth="4" />
      {icon ? (
        <image
          href={icon}
          x="-15"
          y="-15"
          width="30"
          height="30"
          clipPath="url(#avatar-clip)"
          style={dead ? { filter: "grayscale(1) brightness(0.6)" } : undefined}
        />
      ) : (
        <circle r="10" fill={color} opacity={dead ? 0.4 : 1} />
      )}
      {dead && (
        <path
          d="M-12 -12 12 12M12 -12-12 12"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
      <g transform={`translate(0 ${labelOffset})`}>
        <rect
          x={-(label.length * 4.6 + 10)}
          y="-11"
          width={label.length * 9.2 + 20}
          height="22"
          rx="11"
          fill="#0b0e13"
          fillOpacity="0.85"
          stroke={isSelf ? "white" : color}
          strokeOpacity={isSelf ? 0.9 : 0.6}
          strokeWidth="1.5"
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          className={`font-display text-[14px] font-semibold ${isSelf ? "fill-white" : "fill-white/85"}`}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

function KillLine({
  from,
  to,
  ally,
  weaponIcon,
}: {
  from: Vec2;
  to: Vec2;
  ally: boolean;
  weaponIcon: string | undefined;
}) {
  const color = ally ? "var(--color-ally)" : "var(--color-enemy)";
  // Stop short of both markers so the arrowhead stays visible.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const trim = Math.min(26, len / 3);
  const a = { x: from.x + (dx / len) * trim, y: from.y + (dy / len) * trim };
  const b = { x: to.x - (dx / len) * trim, y: to.y - (dy / len) * trim };
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        markerEnd={`url(#arrow-${ally ? "ally" : "enemy"})`}
      />
      {weaponIcon && len > 120 && (
        <g transform={`translate(${mid.x} ${mid.y})`}>
          <rect
            x="-34"
            y="-13"
            width="68"
            height="26"
            rx="6"
            fill="#0b0e13"
            fillOpacity="0.9"
            stroke={color}
            strokeOpacity="0.5"
          />
          <image
            href={weaponIcon}
            x="-28"
            y="-9"
            width="56"
            height="18"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      )}
    </g>
  );
}

function SpikeMarker({ at, active }: { at: Vec2; active: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y}) scale(${MARKER_SCALE})`}>
      <title>{active ? "Spike planted" : "Spike defused"}</title>
      {active && (
        <circle r="30" fill="var(--color-spike)" opacity="0.35" filter="url(#glow)">
          <animate attributeName="r" values="22;36;22" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <path
        d="M0 -17 13 0 0 17 -13 0z"
        fill={active ? "var(--color-spike)" : "#6b7280"}
        stroke="#0b0e13"
        strokeWidth="3"
      />
      <path d="M0 -8v16" stroke="#0b0e13" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function FallbackGrid() {
  const lines = Array.from({ length: 19 }, (_, i) => (i + 1) * 50);
  return (
    <g stroke="#1b2430" strokeWidth="1">
      {lines.map((v) => (
        <g key={v}>
          <line x1={v} y1={0} x2={v} y2={VIEW} />
          <line x1={0} y1={v} x2={VIEW} y2={v} />
        </g>
      ))}
    </g>
  );
}

/** Lines of constant game X and game Y every 1000 units, plus callout reference points. */
function CalibrationGrid({ map, px }: { map: MapConfig; px: (p: Vec2) => Vec2 }) {
  const cal = map.calibration;
  const a = fromNormalized(cal, { x: 0, y: 0 });
  const b = fromNormalized(cal, { x: 1, y: 1 });
  const step = 1000;
  const range = (lo: number, hi: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(Math.min(lo, hi) / step) * step; v <= Math.max(lo, hi); v += step)
      out.push(v);
    return out;
  };
  return (
    <g className="font-mono text-[11px]">
      {range(a.x, b.x).map((gx) => {
        const y = px({ x: gx, y: 0 }).y;
        return (
          <g key={`x${gx}`}>
            <line x1={0} y1={y} x2={VIEW} y2={y} stroke="#60a5fa" strokeOpacity="0.35" />
            <text x={4} y={y - 4} className="fill-sky-300/80">{`x=${gx}`}</text>
          </g>
        );
      })}
      {range(a.y, b.y).map((gy) => {
        const x = px({ x: 0, y: gy }).x;
        return (
          <g key={`y${gy}`}>
            <line x1={x} y1={0} x2={x} y2={VIEW} stroke="#60a5fa" strokeOpacity="0.35" />
            <text x={x + 4} y={VIEW - 6} className="fill-sky-300/80">{`y=${gy}`}</text>
          </g>
        );
      })}
      {map.callouts.map((c) => {
        const at = px(c.pos);
        return (
          <path
            key={`${c.region}-${c.name}-pt`}
            d={`M${at.x - 8} ${at.y}h16M${at.x} ${at.y - 8}v16`}
            stroke="var(--color-spike)"
            strokeWidth="2"
          />
        );
      })}
    </g>
  );
}
