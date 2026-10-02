import type { SessionInfo } from "@replay-lab/shared";
import { useNav } from "../state/nav.js";

export function TopBar({ session }: { session: SessionInfo | undefined }) {
  const { page, go } = useNav();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1680px] items-stretch gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="leading-none">
            <div className="font-display text-[26px] tracking-[0.08em] text-bone">Replay Lab</div>
          </div>
        </div>
        <nav className="flex items-stretch gap-6" aria-label="Sections">
          {(
            [
              ["review", "Round review"],
              ["strats", "Strat board"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={page === id ? "page" : undefined}
              onClick={() => go(id)}
              className={`relative flex items-center px-1 font-cond text-sm font-semibold uppercase tracking-[0.2em] transition ${
                page === id ? "text-bone" : "text-muted hover:text-soft"
              }`}
            >
              {label}
              {page === id && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-red" />}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center">
          {session && <SourceTag session={session} />}
        </div>
      </div>
    </header>
  );
}

/** Our own mark: a reticle bracket around a rewind chevron. */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <path
        d="M2 10V2h8M22 2h8v8M30 22v8h-8M10 30H2v-8"
        fill="none"
        stroke="var(--color-bone)"
        strokeWidth="2.5"
      />
      <path d="M19 9 12 16l7 7" fill="none" stroke="var(--color-red)" strokeWidth="3.5" />
      <path d="M24 12v8" stroke="var(--color-red)" strokeWidth="3.5" />
    </svg>
  );
}

function SourceTag({ session }: { session: SessionInfo }) {
  const live = session.source === "live";
  return (
    <span
      className={`flex items-center gap-2 border px-3 py-1.5 font-cond text-xs font-semibold uppercase tracking-[0.18em] ${
        live ? "border-ally/50 text-ally" : "border-spike/50 text-spike"
      }`}
      title={
        live
          ? "Data from the Riot API"
          : "Sample matches generated locally. Set RIOT_SOURCE=live in .env for real data."
      }
    >
      <span className={`h-2 w-2 ${live ? "bg-ally" : "bg-spike"}`} />
      {live ? (session.riotId ?? "Live") : "Sample data"}
    </span>
  );
}
