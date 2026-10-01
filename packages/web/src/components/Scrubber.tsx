import { useRef } from "react";
import type { RoundEvent, TeamSide } from "@replay-lab/shared";
import { formatRoundTime } from "../replay/select.js";
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from "./Icons.js";

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

/** Round timeline: event ticks above a hard-edged track, transport controls below. */
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

  const markerColor = (e: RoundEvent) =>
    e.type === "kill"
      ? props.teamOf(e.killer ?? "") === props.selfTeam
        ? "bg-ally"
        : "bg-red"
      : e.type === "plant"
        ? "bg-spike"
        : "bg-sky-300";

  return (
    <div className="border border-line bg-panel">
      {/* Timeline */}
      <div className="px-5 pb-2 pt-3">
        <div className="relative h-5">
          {events.map((e, i) => (
            <button
              key={i}
              type="button"
              title={`${formatRoundTime(e.t)} · ${props.describe(e)}`}
              aria-label={`Jump to ${formatRoundTime(e.t)}: ${props.describe(e)}`}
              onClick={() => onSeek(e.t)}
              className="group absolute top-0 flex h-5 w-3 -translate-x-1/2 items-end justify-center"
              style={{ left: pct(e.t) }}
            >
              <span
                className={`block h-2.5 w-2.5 rotate-45 ${markerColor(e)} transition-transform group-hover:scale-150 ${
                  e.t === t ? "outline outline-2 outline-offset-2 outline-bone" : ""
                }`}
              />
            </button>
          ))}
        </div>
        <div
          ref={track}
          className="relative mt-1.5 h-6 cursor-pointer"
          onPointerDown={(ev) => {
            ev.currentTarget.setPointerCapture(ev.pointerId);
            seekFromPointer(ev.clientX);
          }}
          onPointerMove={(ev) => {
            if (ev.buttons === 1) seekFromPointer(ev.clientX);
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-raised" />
          {props.plantWindow && (
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 bg-spike/60"
              style={{
                left: pct(props.plantWindow.from),
                width: `calc(${pct(props.plantWindow.to)} - ${pct(props.plantWindow.from)})`,
              }}
              title="Spike planted"
            />
          )}
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-bone/80"
            style={{ width: pct(t) }}
          />
          {events.map((e, i) => (
            <div
              key={i}
              className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-soft/50"
              style={{ left: pct(e.t) }}
            />
          ))}
          {/* Playhead */}
          <div
            className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-bone"
            style={{ left: pct(t) }}
          >
            <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-bone" />
          </div>
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
      </div>

      {/* Transport + clock */}
      <div className="flex items-center gap-1 border-t border-line px-3 py-2">
        <TransportButton
          label="Previous event (←)"
          disabled={!prev}
          onClick={() => prev && onSeek(prev.t)}
        >
          <PrevIcon size={15} />
        </TransportButton>
        <button
          type="button"
          onClick={props.onTogglePlay}
          aria-label={props.playing ? "Pause (space)" : "Play (space)"}
          title={props.playing ? "Pause (space)" : "Play (space)"}
          className="cut-sm grid h-9 w-12 place-items-center bg-red text-bone transition hover:brightness-110"
        >
          {props.playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
        </button>
        <TransportButton
          label="Next event (→)"
          disabled={!next}
          onClick={() => next && onSeek(next.t)}
        >
          <NextIcon size={15} />
        </TransportButton>
        <button
          type="button"
          onClick={props.onCycleSpeed}
          className="ml-2 w-10 border border-line py-1 font-cond text-xs font-bold tracking-wider text-soft hover:border-soft hover:text-bone"
          title="Playback speed"
        >
          {props.speed}×
        </button>
        <div className="ml-auto flex items-baseline gap-2">
          <span className="hud-label !text-[10px]">Round time</span>
          <span className="font-display text-3xl leading-none tabular text-bone">
            {formatRoundTime(t)}
          </span>
          <span className="font-display text-xl leading-none tabular text-muted">
            / {formatRoundTime(end)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TransportButton({
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
      className="grid h-10 w-9 place-items-center text-soft transition hover:text-bone disabled:opacity-25"
    >
      {children}
    </button>
  );
}
