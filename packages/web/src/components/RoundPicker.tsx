import type { RoundReplay, TeamSide } from "@replay-lab/shared";

type Props = {
  rounds: RoundReplay[];
  selected: number;
  selfTeam: TeamSide | undefined;
  onSelect: (index: number) => void;
};

const SHORT: Record<string, string> = {
  Eliminated: "Elim",
  "Bomb detonated": "Boom",
  "Bomb defused": "Defuse",
  "Round timer expired": "Time",
};

export function RoundPicker({ rounds, selected, selfTeam, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Rounds">
      {rounds.map((r, i) => {
        const won = r.winningTeam === selfTeam;
        return (
          <button
            key={r.roundNum}
            type="button"
            role="tab"
            aria-selected={i === selected}
            title={`Round ${r.roundNum + 1}: ${won ? "won" : "lost"} (${r.resultType})`}
            onClick={() => onSelect(i)}
            className={`w-12 rounded border px-1 py-1 text-xs ${
              won ? "border-teal-700 bg-teal-950" : "border-red-800 bg-red-950"
            } ${i === selected ? "ring-2 ring-white" : ""}`}
          >
            <div className="font-semibold">{r.roundNum + 1}</div>
            <div className="text-[10px] text-neutral-400">
              {SHORT[r.resultType] ?? r.resultType}
            </div>
          </button>
        );
      })}
    </div>
  );
}
