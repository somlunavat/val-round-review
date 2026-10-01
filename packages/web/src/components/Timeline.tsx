import type { RoundEvent, TeamSide } from "@replay-lab/shared";
import { formatRoundTime } from "../replay/select.js";

type Props = {
  events: RoundEvent[];
  end: number;
  t: number;
  onSeek: (t: number) => void;
  teamOf: (puuid: string) => TeamSide | undefined;
  selfTeam: TeamSide | undefined;
  labelOf: (puuid: string | undefined) => string;
};

function describe(e: RoundEvent, labelOf: Props["labelOf"]): string {
  switch (e.type) {
    case "kill":
      return `${labelOf(e.killer)} killed ${labelOf(e.victim)}`;
    case "plant":
      return `${labelOf(e.planter)} planted on ${e.site}`;
    case "defuse":
      return `${labelOf(e.defuser)} defused`;
  }
}

export function Timeline({ events, end, t, onSeek, teamOf, selfTeam, labelOf }: Props) {
  const pct = (ms: number) => `${Math.min(100, (ms / end) * 100)}%`;
  const prev = [...events].reverse().find((e) => e.t < t);
  const next = events.find((e) => e.t > t);

  return (
    <div className="space-y-2">
      <div className="relative h-6">
        {events.map((e, i) => {
          const color =
            e.type === "kill"
              ? e.killer && teamOf(e.killer) === selfTeam
                ? "bg-teal-400"
                : "bg-red-400"
              : "bg-yellow-400";
          return (
            <button
              key={i}
              type="button"
              title={`${formatRoundTime(e.t)} · ${describe(e, labelOf)}`}
              aria-label={`Jump to ${formatRoundTime(e.t)}: ${describe(e, labelOf)}`}
              onClick={() => onSeek(e.t)}
              className={`absolute top-0 h-6 w-1.5 -translate-x-1/2 rounded ${color} ${e.t === t ? "ring-2 ring-white" : ""}`}
              style={{ left: pct(e.t) }}
            />
          );
        })}
      </div>
      <input
        type="range"
        min={0}
        max={end}
        step={100}
        value={t}
        onChange={(ev) => onSeek(Number(ev.target.value))}
        className="w-full accent-teal-400"
        aria-label="Round time"
      />
      <div className="flex items-center justify-between text-sm text-neutral-400">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onSeek(prev.t)}
          className="rounded px-2 py-1 hover:bg-neutral-800 disabled:opacity-30"
        >
          ← Prev event
        </button>
        <span className="tabular-nums">
          {formatRoundTime(t)} / {formatRoundTime(end)}
        </span>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSeek(next.t)}
          className="rounded px-2 py-1 hover:bg-neutral-800 disabled:opacity-30"
        >
          Next event →
        </button>
      </div>
      <ol className="max-h-40 space-y-0.5 overflow-y-auto text-sm">
        {events.map((e, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSeek(e.t)}
              className={`w-full rounded px-2 py-0.5 text-left hover:bg-neutral-800 ${e.t === t ? "bg-neutral-800" : ""}`}
            >
              <span className="mr-2 tabular-nums text-neutral-500">{formatRoundTime(e.t)}</span>
              {describe(e, labelOf)}
            </button>
          </li>
        ))}
        {events.length === 0 && (
          <li className="px-2 text-neutral-500">No events recorded this round.</li>
        )}
      </ol>
    </div>
  );
}
