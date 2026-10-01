import type { ReactNode } from "react";

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "error";
  title?: string;
  children: ReactNode;
}) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`border-l-[3px] px-4 py-3 text-sm ${
        error ? "border-red bg-enemy-dim/70 text-bone" : "border-muted bg-panel text-soft"
      }`}
    >
      {title && (
        <div
          className={`mb-1 font-cond text-xs font-bold uppercase tracking-[0.2em] ${error ? "text-red" : "text-bone"}`}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-raised/60 ${className}`} />;
}

/** Section heading: small caps label with a rule. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="hud-label text-bone">{children}</span>
      <span className="h-px flex-1 bg-line" />
      {right && <span className="hud-label">{right}</span>}
    </div>
  );
}
