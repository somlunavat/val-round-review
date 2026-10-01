import type { SessionInfo } from "@replay-lab/shared";

export function TopBar({ session }: { session: SessionInfo | undefined }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface ring-1 ring-line">
          <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
            <path
              d="M8 23 16 8l8 15"
              fill="none"
              stroke="var(--color-ally)"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <div className="font-display text-lg font-bold uppercase leading-none tracking-[0.12em]">
            Replay Lab
          </div>
          <div className="text-xs text-muted">Round review for your own matches</div>
        </div>
        <div className="ml-auto">{session && <SourceBadge session={session} />}</div>
      </div>
    </header>
  );
}

function SourceBadge({ session }: { session: SessionInfo }) {
  const live = session.source === "live";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        live
          ? "border-ally/40 bg-ally-dim/50 text-ally"
          : "border-spike/40 bg-spike-dim/50 text-spike"
      }`}
      title={
        live
          ? "Data from the Riot API"
          : "Sample matches generated locally. Set RIOT_SOURCE=live in .env for real data."
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-ally" : "bg-spike"}`} />
      {live ? `Live · ${session.riotId ?? "Riot API"}` : "Sample data"}
    </span>
  );
}
