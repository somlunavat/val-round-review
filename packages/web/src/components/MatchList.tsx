import type { MatchSummary } from "@replay-lab/shared";
import { mapDisplayName } from "@replay-lab/shared";
import type { ContentLookup } from "../content/lookup.js";

type Props = {
  matches: MatchSummary[];
  selected: string | undefined;
  lookup: ContentLookup;
  onSelect: (matchId: string) => void;
};

export function MatchList({ matches, selected, lookup, onSelect }: Props) {
  if (matches.length === 0) {
    return <p className="px-1 text-sm text-muted">No matches found for your account yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {matches.map((m) => {
        const thumb = lookup.map(m.mapId)?.thumbnail;
        const agent = lookup.agent(m.selfCharacterId);
        const active = m.matchId === selected;
        return (
          <li key={m.matchId}>
            <button
              type="button"
              onClick={() => onSelect(m.matchId)}
              aria-label={`${mapDisplayName(m.mapId)} ${m.roundsWon}–${m.roundsLost} ${m.won ? "win" : "loss"}`}
              className={`group relative w-full overflow-hidden rounded-xl border text-left transition ${
                active
                  ? "border-white/60 shadow-lg shadow-black/40"
                  : "border-line hover:border-muted"
              }`}
            >
              {thumb && (
                <img
                  src={thumb}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-40 transition group-hover:opacity-55"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
              <div className={`absolute inset-y-0 left-0 w-1 ${m.won ? "bg-ally" : "bg-enemy"}`} />
              <div className="relative flex items-center gap-3 px-4 py-3">
                {agent?.icon ? (
                  <img
                    src={agent.icon}
                    alt={agent.name}
                    className="h-10 w-10 rounded-lg bg-raised object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-raised" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-base font-semibold text-white">
                      {mapDisplayName(m.mapId)}
                    </span>
                    <span
                      className={`font-display text-lg font-bold tabular ${m.won ? "text-ally" : "text-enemy"}`}
                    >
                      {m.roundsWon}–{m.roundsLost}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="truncate">
                      {relativeDate(m.gameStartMillis)} · {queueLabel(m.queueId)}
                    </span>
                    {m.selfStats && (
                      <span className="tabular text-soft">
                        {m.selfStats.kills}/{m.selfStats.deaths}/{m.selfStats.assists}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function queueLabel(queueId: string | undefined): string {
  if (!queueId) return "Custom";
  return queueId.charAt(0).toUpperCase() + queueId.slice(1);
}

function relativeDate(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
