import { useRef } from "react";
import type { RoundEvent, TeamSide } from "@replay-lab/shared";
import { formatRoundTime } from "../replay/select.js";
import {
  DefuseIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  SkullIcon,
  SpikeIcon,
} from "./Icons.js";

type Props = {
  events: RoundEvent[];
  end: number;
  t: number;
  plantWindow: { from: number; to: number } | undefined;
  playing: boolean;
  speed: number;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
  onCycleSpeed: () => void;
  teamOf: (puuid: string) => TeamSide | undefined;
  selfTeam: TeamSide | undefined;
  describe: (e: RoundEvent) => string;
};

export function Scrubber(props: Props) {
  const { events, end, t, onSeek } = props;
  const track = useRef<HTMLDivElement>(null);
  const pct = (ms: number) => `${Math.min(100, Math.max(0, (ms / end) * 100))}%`;
  const prev = [...events].reverse().find((e) => e.t < t);
  const next = events.find((e) => e.t > t);

  const seekFromPointer = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * end));
  };

  return (
    <div className="rounded-2xl border border-line bg-panel px-4 pb-3 pt-4">
      {/* Event pins */}
      <div className="relative mx-2 h-7">
        {events.map((e, i) => {
          const ally =
            e.type === "kill" ? props.teamOf(e.killer ?? "") === props.selfTeam : undefined;
          const tone =
            e.type === "kill"
              ? ally
                ? "bg-ally text-ink"
                : "bg-enemy text-ink"
              : e.type === "plant"
                ? "bg-spike text-ink"
                : "bg-sky-400 text-ink";
          const Icon = e.type === "kill" ? SkullIcon : e.type === "plant" ? SpikeIcon : DefuseIcon;
          return (
            <button
              key={i}
              type="button"
              title={`${formatRoundTime(e.t)} · ${props.describe(e)}`}
              aria-label={`Jump to ${formatRoundTime(e.t)}: ${props.describe(e)}`}
              onClick={() => onSeek(e.t)}
              className={`absolute top-0 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full ${tone} shadow-md shadow-black/40 transition hover:scale-125 ${
                e.t === t ? "ring-2 ring-white ring-offset-2 ring-offset-panel" : ""
              }`}
              style={{ left: pct(e.t) }}
            >
              <Icon size={13} strokeWidth={2.5} />
            </button>
          );
        })}
      </div>

      {/* Track */}
      <div
        ref={track}
        className="relative mx-2 mt-2 h-2.5 cursor-pointer rounded-full bg-raised"
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          seekFromPointer(ev.clientX);
        }}
        onPointerMove={(ev) => {
          if (ev.buttons === 1) seekFromPointer(ev.clientX);
        }}
      >
        {props.plantWindow && (
          <div
            className="absolute inset-y-0 rounded-full bg-spike/25"
            style={{
              left: pct(props.plantWindow.from),
              width: `calc(${pct(props.plantWindow.to)} - ${pct(props.plantWindow.from)})`,
            }}
            title="Spike planted"
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ally/40 to-ally"
          style={{ width: pct(t) }}
        />
        {events.map((e, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-px bg-white/30"
            style={{ left: pct(e.t) }}
          />
        ))}
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-white shadow-lg"
          style={{ left: pct(t) }}
        />
        <input
          type="range"
          min={0}
          max={end}
          step={100}
          value={t}
          onChange={(ev) => onSeek(Number(ev.target.value))}
          className="sr-only"
          aria-label="Round time"
        />
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-2">
        <IconButton
          label="Previous event (←)"
          disabled={!prev}
          onClick={() => prev && onSeek(prev.t)}
        >
          <PrevIcon size={16} />
        </IconButton>
        <button
          type="button"
          onClick={props.onTogglePlay}
          aria-label={props.playing ? "Pause (space)" : "Play (space)"}
          title={props.playing ? "Pause (space)" : "Play (space)"}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition hover:scale-105"
        >
          {props.playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
        <IconButton label="Next event (→)" disabled={!next} onClick={() => next && onSeek(next.t)}>
          <NextIcon size={16} />
        </IconButton>
        <button
          type="button"
          onClick={props.onCycleSpeed}
          className="ml-1 rounded-md border border-line px-2 py-1 font-display text-xs font-semibold text-soft hover:border-muted hover:text-white"
          title="Playback speed"
        >
          {props.speed}×
        </button>
        <div className="ml-auto font-display text-lg font-semibold tabular text-white">
          {formatRoundTime(t)}
          <span className="text-muted"> / {formatRoundTime(end)}</span>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full text-soft transition hover:bg-raised hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
