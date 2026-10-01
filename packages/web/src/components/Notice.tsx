import type { ReactNode } from "react";

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded border px-3 py-2 text-sm ${
        tone === "error"
          ? "border-red-800 bg-red-950 text-red-200"
          : "border-neutral-800 text-neutral-400"
      }`}
    >
      {children}
    </div>
  );
}
