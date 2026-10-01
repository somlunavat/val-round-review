import type { RoundReplay, TeamSide } from "@replay-lab/shared";
import { ResultIcon } from "./Icons.js";

type Props = {
  rounds: RoundReplay[];
  selected: number;
  selfTeam: TeamSide | undefined;
  onSelect: (index: number) => void;
};

/** Rounds grouped into halves and overtime, like the in-game round history. */
export function RoundStrip({ rounds, selected, selfTeam, onSelect }: Props) {
  const groups = [
    { label: "1st half", rounds: rounds.filter((r) => r.roundNum < 12) },
    { label: "2nd half", rounds: rounds.filter((r) => r.roundNum >= 12 && r.roundNum < 24) },
    { label: "Overtime", rounds: rounds.filter((r) => r.roundNum >= 24) },
  ].filter((g) => g.rounds.length > 0);

  return (
    <div className="flex gap-4 overflow-x-auto pb-1" role="tablist" aria-label="Rounds">
      {groups.map((g) => (
        <div key={g.label} className="shrink-0">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            {g.label}
          </div>
          <div className="flex gap-1">
            {g.rounds.map((r) => {
              const index = rounds.indexOf(r);
              const won = r.winningTeam === selfTeam;
              const active = index === selected;
              return (
                <button
                  key={r.roundNum}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={`Round ${r.roundNum + 1}: ${won ? "won" : "lost"} · ${r.resultType}`}
                  aria-label={`Round ${r.roundNum + 1}: ${won ? "won" : "lost"} · ${r.resultType}`}
                  onClick={() => onSelect(index)}
                  className={`group relative flex h-14 w-10 flex-col items-center justify-center gap-1 rounded-lg border transition ${
                    active
                      ? won
                        ? "border-ally bg-ally text-ink"
                        : "border-enemy bg-enemy text-ink"
                      : won
                        ? "border-ally/25 bg-ally-dim/50 text-ally hover:border-ally/70"
                        : "border-enemy/25 bg-enemy-dim/50 text-enemy hover:border-enemy/70"
                  }`}
                >
                  <ResultIcon result={r.resultType} size={15} strokeWidth={2.25} />
                  <span
                    className={`font-display text-xs font-bold ${active ? "text-ink" : "text-white/80"}`}
                  >
                    {r.roundNum + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
