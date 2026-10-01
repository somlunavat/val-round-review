import type { RoundReplay, TeamSide } from "@replay-lab/shared";
import { ResultIcon } from "./Icons.js";

type Props = {
  rounds: RoundReplay[];
  selected: number;
  selfTeam: TeamSide | undefined;
  onSelect: (index: number) => void;
};

/** Round history like the in-game timeline: halves split by a side-switch divider. */
export function RoundStrip({ rounds, selected, selfTeam, onSelect }: Props) {
  const groups = [
    rounds.filter((r) => r.roundNum < 12),
    rounds.filter((r) => r.roundNum >= 12 && r.roundNum < 24),
    rounds.filter((r) => r.roundNum >= 24),
  ].filter((g) => g.length > 0);

  return (
    <div className="flex items-end gap-0 overflow-x-auto pb-2" role="tablist" aria-label="Rounds">
      {groups.map((g, gi) => (
        <div key={gi} className="flex shrink-0 items-end">
          {gi > 0 && (
            <div className="mx-2 flex h-12 flex-col items-center justify-center" aria-hidden="true">
              <span className="h-full w-px bg-line" />
              <span className="my-1 font-cond text-[9px] font-bold uppercase tracking-[0.2em] text-muted [writing-mode:vertical-rl]">
                {gi === 1 ? "Swap" : "OT"}
              </span>
              <span className="h-full w-px bg-line" />
            </div>
          )}
          <div className="flex gap-[3px]">
            {g.map((r) => {
              const index = rounds.indexOf(r);
              const won = r.winningTeam === selfTeam;
              const active = index === selected;
              const label = `Round ${r.roundNum + 1}: ${won ? "won" : "lost"} · ${r.resultType}`;
              return (
                <button
                  key={r.roundNum}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={label}
                  title={label}
                  onClick={() => onSelect(index)}
                  className="group relative flex w-9 flex-col items-center gap-1"
                >
                  <span
                    className={`font-cond text-[11px] font-bold tabular ${active ? "text-bone" : "text-muted group-hover:text-soft"}`}
                  >
                    {r.roundNum + 1}
                  </span>
                  <span
                    className={`grid h-9 w-9 place-items-center border transition ${
                      won
                        ? active
                          ? "border-ally bg-ally text-ink"
                          : "border-ally/30 bg-ally-dim text-ally group-hover:border-ally/80"
                        : active
                          ? "border-red bg-red text-ink"
                          : "border-red/30 bg-enemy-dim text-red group-hover:border-red/80"
                    }`}
                  >
                    <ResultIcon result={r.resultType} size={16} strokeWidth={2.4} />
                  </span>
                  <span className={`h-[3px] w-full ${active ? "bg-bone" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
