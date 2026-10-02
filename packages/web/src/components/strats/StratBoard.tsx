import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { MapData, StratFrame, StratShape, StratToken } from "@replay-lab/shared";
import type { ContentLookup } from "../../content/lookup.js";
import { toNormalized } from "../../maps/calibration.js";
import { newId, useStrats, type Tool } from "../../state/strats.js";

const VIEW = 1000;
type P = [number, number];

type Props = {
  map: MapData;
  minimapUrl: string | undefined;
  frame: StratFrame;
  lookup: ContentLookup;
  showCallouts: boolean;
};

const UTILITY_TOOLS = new Set<Tool>(["smoke", "flash", "molly", "recon"]);

/** The whiteboard: minimap underneath, plan drawn on top in normalized coordinates. */
export function StratBoard({ map, minimapUrl, frame, lookup, showCallouts }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const { tool, color, placing, selected } = useStrats();
  const { addShape, addToken, removeItem, select, editFrame } = useStrats.getState();
  const [draft, setDraft] = useState<{ kind: "path" | "wall"; points: P[] } | undefined>();
  const [drag, setDrag] = useState<{ id: string; from: P; delta: P } | undefined>();
  const [textAt, setTextAt] = useState<P | undefined>();
  const [imageFailed, setImageFailed] = useState(false);

  /** Pointer position in normalized board coordinates (0..1). */
  const toBoard = (ev: { clientX: number; clientY: number }): P => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return [0, 0];
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    return [clamp(pt.x / VIEW), clamp(pt.y / VIEW)];
  };

  const onBoardDown = (ev: ReactPointerEvent<SVGSVGElement>) => {
    if (ev.button !== 0) return;
    const p = toBoard(ev);
    if (tool === "pen" || tool === "arrow" || tool === "wall") {
      ev.currentTarget.setPointerCapture(ev.pointerId);
      setDraft({ kind: tool === "wall" ? "wall" : "path", points: [p] });
    } else if (tool === "text") {
      // Keep focus from leaving the text box we're about to open.
      ev.preventDefault();
      setTextAt(p);
    } else if (tool === "agent") {
      addToken({
        id: newId(),
        side: placing.side,
        at: p,
        ...(placing.agentId ? { agentId: placing.agentId } : {}),
      });
    } else if (UTILITY_TOOLS.has(tool)) {
      addShape({ id: newId(), kind: "utility", type: tool as "smoke", at: p, color });
    } else if (tool === "select") {
      select(undefined);
    }
  };

  const onBoardMove = (ev: ReactPointerEvent<SVGSVGElement>) => {
    if (draft) {
      const p = toBoard(ev);
      const last = draft.points.at(-1);
      if (draft.kind === "wall") {
        setDraft({ ...draft, points: [draft.points[0] ?? p, p] });
      } else if (!last || dist(last, p) * VIEW > 4) {
        setDraft({ ...draft, points: [...draft.points, p] });
      }
    } else if (drag) {
      const p = toBoard(ev);
      setDrag({ ...drag, delta: [p[0] - drag.from[0], p[1] - drag.from[1]] });
    }
  };

  const onBoardUp = () => {
    if (draft) {
      const pts = draft.points;
      if (draft.kind === "wall" && pts.length === 2 && dist(pts[0] as P, pts[1] as P) > 0.01) {
        addShape({
          id: newId(),
          kind: "utility",
          type: "wall",
          at: pts[0] as P,
          to: pts[1] as P,
          color,
        });
      } else if (draft.kind === "path" && pts.length >= 2) {
        addShape({ id: newId(), kind: "path", points: round(pts), color, arrow: tool === "arrow" });
      }
      setDraft(undefined);
    }
    if (drag) {
      const [dx, dy] = drag.delta;
      if (Math.abs(dx) + Math.abs(dy) > 0.002) {
        editFrame((f) => moveItem(f, drag.id, dx, dy));
      }
      setDrag(undefined);
    }
  };

  /** Pointer down on an existing item: select+drag, or erase. */
  const onItemDown = (id: string) => (ev: ReactPointerEvent) => {
    if (tool === "erase") {
      ev.stopPropagation();
      removeItem(id);
    } else if (tool === "select") {
      ev.stopPropagation();
      svg.current?.setPointerCapture(ev.pointerId);
      select(id);
      setDrag({ id, from: toBoard(ev), delta: [0, 0] });
    }
  };

  const offset = (id: string): P => (drag?.id === id ? drag.delta : [0, 0]);
  const interactive = tool === "select" || tool === "erase";

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svg}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className={`h-full w-full touch-none select-none ${cursorFor(tool)}`}
        onPointerDown={onBoardDown}
        onPointerMove={onBoardMove}
        onPointerUp={onBoardUp}
        role="img"
        aria-label={`${map.displayName} strategy board`}
      >
        <defs>
          <clipPath id="token-clip">
            <circle r="18" />
          </clipPath>
        </defs>
        <rect width={VIEW} height={VIEW} fill="#101b25" />
        {minimapUrl && !imageFailed && (
          <image
            href={minimapUrl}
            width={VIEW}
            height={VIEW}
            opacity={0.85}
            onError={() => setImageFailed(true)}
          />
        )}
        {showCallouts &&
          map.callouts.map((c) => {
            const n = toNormalized(map, c.pos);
            return (
              <text
                key={`${c.region}-${c.name}`}
                x={n.x * VIEW}
                y={n.y * VIEW}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none fill-[#ece8e1]/45 font-cond text-[17px] font-bold uppercase tracking-[0.12em]"
                style={{
                  paintOrder: "stroke",
                  stroke: "#0f1923",
                  strokeWidth: 4,
                  strokeOpacity: 0.6,
                }}
              >
                {c.name === "Site"
                  ? `${c.region} Site`
                  : c.name === "Spawn"
                    ? `${c.region.split(" ")[0]} Spawn`
                    : c.name}
              </text>
            );
          })}

        {frame.shapes.map((s) => (
          <g
            key={s.id}
            transform={`translate(${offset(s.id)[0] * VIEW} ${offset(s.id)[1] * VIEW})`}
            onPointerDown={onItemDown(s.id)}
            className={interactive ? "cursor-pointer" : "pointer-events-none"}
          >
            <ShapeView shape={s} selected={selected === s.id} />
          </g>
        ))}

        {frame.tokens.map((t) => (
          <g
            key={t.id}
            transform={`translate(${(t.at[0] + offset(t.id)[0]) * VIEW} ${(t.at[1] + offset(t.id)[1]) * VIEW})`}
            onPointerDown={onItemDown(t.id)}
            className={interactive ? "cursor-grab" : "pointer-events-none"}
          >
            <TokenView
              token={t}
              icon={lookup.agent(t.agentId)?.icon}
              selected={selected === t.id}
            />
          </g>
        ))}

        {draft?.kind === "path" && draft.points.length > 1 && (
          <PathView points={draft.points} color={color} arrow={tool === "arrow"} />
        )}
        {draft?.kind === "wall" && draft.points.length === 2 && (
          <ShapeView
            shape={{
              id: "draft",
              kind: "utility",
              type: "wall",
              at: draft.points[0] as P,
              to: draft.points[1] as P,
              color,
            }}
            selected={false}
          />
        )}
      </svg>

      {textAt && (
        <TextDraft
          at={textAt}
          onDone={(text) => {
            if (text.trim())
              addShape({
                id: newId(),
                kind: "text",
                at: textAt,
                text: text.trim().slice(0, 120),
                color,
              });
            setTextAt(undefined);
          }}
        />
      )}
    </div>
  );
}

function TextDraft({ at, onDone }: { at: P; onDone: (text: string) => void }) {
  const [value, setValue] = useState("");
  // Enter and blur can both fire; only finish once.
  const done = useRef(false);
  const finish = (text: string) => {
    if (done.current) return;
    done.current = true;
    onDone(text);
  };
  return (
    <input
      autoFocus
      value={value}
      maxLength={120}
      placeholder="Type, then Enter"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(value);
        if (e.key === "Escape") finish("");
      }}
      onBlur={() => finish(value)}
      className="absolute z-30 w-48 -translate-y-1/2 border border-bone bg-ink px-2 py-1 font-cond text-sm font-bold uppercase text-bone outline-none"
      style={{ left: `${at[0] * 100}%`, top: `${at[1] * 100}%` }}
    />
  );
}

function TokenView({
  token,
  icon,
  selected,
}: {
  token: StratToken;
  icon: string | undefined;
  selected: boolean;
}) {
  const color = token.side === "ally" ? "var(--color-ally)" : "var(--color-enemy)";
  return (
    <g>
      {selected && (
        <rect
          x="-30"
          y="-30"
          width="60"
          height="60"
          fill="none"
          stroke="#ece8e1"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      )}
      <circle r="22" fill="#0f1923" stroke={color} strokeWidth="4" />
      {icon ? (
        <image href={icon} x="-18" y="-18" width="36" height="36" clipPath="url(#token-clip)" />
      ) : (
        <circle r="11" fill={color} />
      )}
    </g>
  );
}

function ShapeView({ shape, selected }: { shape: StratShape; selected: boolean }) {
  const glow = selected ? { filter: "drop-shadow(0 0 6px #ece8e1)" } : undefined;
  if (shape.kind === "path") {
    return (
      <g style={glow}>
        {/* Wide transparent stroke makes thin paths easy to grab. */}
        <polyline points={pts(shape.points)} fill="none" stroke="transparent" strokeWidth="24" />
        <PathView points={shape.points} color={shape.color} arrow={shape.arrow} />
      </g>
    );
  }
  if (shape.kind === "text") {
    return (
      <text
        x={shape.at[0] * VIEW}
        y={shape.at[1] * VIEW}
        dominantBaseline="middle"
        fill={shape.color}
        className="font-cond text-[26px] font-bold uppercase tracking-wide"
        style={{ paintOrder: "stroke", stroke: "#0f1923", strokeWidth: 6, ...glow }}
      >
        {shape.text}
      </text>
    );
  }
  const x = shape.at[0] * VIEW;
  const y = shape.at[1] * VIEW;
  switch (shape.type) {
    case "smoke":
      return (
        <g style={glow}>
          <circle
            cx={x}
            cy={y}
            r="42"
            fill="#c9d1d9"
            fillOpacity="0.45"
            stroke="#ece8e1"
            strokeWidth="3"
          />
        </g>
      );
    case "molly":
      return (
        <g style={glow}>
          <circle
            cx={x}
            cy={y}
            r="34"
            fill="#ff7a2f"
            fillOpacity="0.35"
            stroke="#ff7a2f"
            strokeWidth="3"
            strokeDasharray="8 5"
          />
        </g>
      );
    case "recon":
      return (
        <g style={glow}>
          <circle
            cx={x}
            cy={y}
            r="70"
            fill="#4fd1ff"
            fillOpacity="0.08"
            stroke="#4fd1ff"
            strokeWidth="2.5"
            strokeDasharray="4 6"
          />
          <circle cx={x} cy={y} r="7" fill="#4fd1ff" />
        </g>
      );
    case "flash":
      return (
        <g style={glow} transform={`translate(${x} ${y})`}>
          {Array.from({ length: 8 }, (_, k) => (
            <path
              key={k}
              d="M0 -10 L0 -26"
              stroke="#f5c542"
              strokeWidth="5"
              strokeLinecap="round"
              transform={`rotate(${k * 45})`}
            />
          ))}
          <circle r="9" fill="#f5c542" />
        </g>
      );
    case "wall": {
      const to = shape.to ?? shape.at;
      return (
        <g style={glow}>
          <line
            x1={x}
            y1={y}
            x2={to[0] * VIEW}
            y2={to[1] * VIEW}
            stroke="#5ee0d0"
            strokeOpacity="0.85"
            strokeWidth="12"
            strokeLinecap="square"
          />
        </g>
      );
    }
  }
}

function PathView({ points, color, arrow }: { points: P[]; color: string; arrow: boolean }) {
  const end = points.at(-1);
  // Aim the head along the last stretch, not just the last (possibly tiny) segment.
  const back = points[Math.max(0, points.length - 6)];
  let head: string | undefined;
  if (arrow && end && back) {
    const a = Math.atan2((end[1] - back[1]) * VIEW, (end[0] - back[0]) * VIEW);
    const ex = end[0] * VIEW;
    const ey = end[1] * VIEW;
    const len = 22;
    head = `${ex},${ey} ${ex - len * Math.cos(a - 0.45)},${ey - len * Math.sin(a - 0.45)} ${ex - len * Math.cos(a + 0.45)},${ey - len * Math.sin(a + 0.45)}`;
  }
  return (
    <g>
      <polyline
        points={pts(points)}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ paintOrder: "stroke" }}
      />
      {head && <polygon points={head} fill={color} />}
    </g>
  );
}

function moveItem(f: StratFrame, id: string, dx: number, dy: number): StratFrame {
  const mv = (p: P): P => [clamp(p[0] + dx), clamp(p[1] + dy)];
  return {
    ...f,
    tokens: f.tokens.map((t) => (t.id === id ? { ...t, at: mv(t.at) } : t)),
    shapes: f.shapes.map((s): StratShape => {
      if (s.id !== id) return s;
      if (s.kind === "path") return { ...s, points: s.points.map(mv) };
      if (s.kind === "utility") return { ...s, at: mv(s.at), ...(s.to ? { to: mv(s.to) } : {}) };
      return { ...s, at: mv(s.at) };
    }),
  };
}

function cursorFor(tool: Tool): string {
  if (tool === "select") return "cursor-default";
  if (tool === "erase") return "cursor-not-allowed";
  if (tool === "text") return "cursor-text";
  return "cursor-crosshair";
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pts = (points: P[]) => points.map(([x, y]) => `${x * VIEW},${y * VIEW}`).join(" ");
const round = (points: P[]): P[] =>
  points.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
