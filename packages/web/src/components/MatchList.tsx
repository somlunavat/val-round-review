import type { MatchSummary } from "@replay-lab/shared";
import { mapDisplayName } from "@replay-lab/shared";
import type { ContentLookup } from "../content/lookup.js";

type Props = {
  matches: MatchSummary[];
  selected: string | undefined;
  lookup: ContentLookup;
  onSelect: (matchId: string) => void;
};

/** Match history rows, styled like an in-game career list. */
export function MatchList({ matches, selected, lookup, onSelect }: Props) {
  if (matches.length === 0) {
    return <p className="text-sm text-muted">No matches found for your account yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
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
              aria-current={active}
              className={`cut group relative flex h-[68px] w-full items-stretch overflow-hidden text-left transition ${
                active ? "bg-raised" : "bg-panel hover:bg-raised/70"
              }`}
            >
              {thumb && (
                <img
                  src={thumb}
                  alt=""
                  className={`absolute inset-y-0 right-0 h-full w-2/3 object-cover transition ${
                    active ? "opacity-45" : "opacity-25 group-hover:opacity-35"
                  }`}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${active ? "from-raised via-raised/90" : "from-panel via-panel/90"} to-transparent`}
              />
              <div className={`relative w-1.5 shrink-0 ${m.won ? "bg-ally" : "bg-red"}`} />
              <div className="relative flex min-w-0 flex-1 items-center gap-3 px-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden bg-ink">
                  {agent?.icon && (
                    <img src={agent.icon} alt={agent.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-2xl leading-none tracking-wide text-bone">
                      {mapDisplayName(m.mapId)}
                    </span>
                    <span className="font-display text-2xl leading-none tabular">
                      <span className={m.won ? "text-ally" : "text-bone"}>{m.roundsWon}</span>
                      <span className="mx-0.5 text-muted">:</span>
                      <span className={m.won ? "text-bone" : "text-red"}>{m.roundsLost}</span>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 font-cond text-xs font-semibold uppercase tracking-[0.12em]">
                    <span className={m.won ? "text-ally" : "text-red"}>
                      {m.won ? "Victory" : "Defeat"}
                    </span>
                    <span className="truncate text-muted">
                      {m.selfStats
                        ? `${m.selfStats.kills}/${m.selfStats.deaths}/${m.selfStats.assists} · `
                        : ""}
                      {relativeDate(m.gameStartMillis)}
                    </span>
                  </div>
                </div>
              </div>
              {active && <span className="absolute right-0 top-0 h-full w-[3px] bg-bone" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function relativeDate(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
