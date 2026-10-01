import type { MatchSummary } from "@replay-lab/shared";
import { mapDisplayName } from "@replay-lab/shared";

type Props = {
  matches: MatchSummary[];
  selected: string | undefined;
  onSelect: (matchId: string) => void;
};

export function MatchPicker({ matches, selected, onSelect }: Props) {
  if (matches.length === 0) {
    return <p className="text-neutral-400">No matches found for your account yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {matches.map((m) => (
        <li key={m.matchId}>
          <button
            type="button"
            onClick={() => onSelect(m.matchId)}
            className={`w-full rounded border px-3 py-2 text-left text-sm hover:bg-neutral-800 ${
              m.matchId === selected ? "border-neutral-400 bg-neutral-800" : "border-neutral-800"
            }`}
          >
            <div className="flex justify-between">
              <span className="font-medium">{mapDisplayName(m.mapId)}</span>
              <span className={m.won ? "text-teal-400" : "text-red-400"}>
                {m.roundsWon}–{m.roundsLost} {m.won ? "W" : "L"}
              </span>
            </div>
            <div className="text-xs text-neutral-500">
              {new Date(m.gameStartMillis).toLocaleString()} · {m.queueId ?? "custom"}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
