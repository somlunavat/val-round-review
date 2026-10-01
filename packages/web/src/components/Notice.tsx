import type { ReactNode } from "react";
import { AlertIcon } from "./Icons.js";

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
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${
        error ? "border-enemy/40 bg-enemy-dim/60 text-red-100" : "border-line bg-panel text-soft"
      }`}
    >
      {error && <AlertIcon size={18} className="mt-0.5 shrink-0 text-enemy" />}
      <div>
        {title && <div className="mb-0.5 font-medium text-white">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-raised/70 ${className}`} />;
}
