import type { ContentItem } from "@replay-lab/shared";

/** Agent avatar + name, coloured by side. */
export function PlayerChip({
  label,
  agent,
  ally,
  isSelf,
  size = "sm",
}: {
  label: string;
  agent: ContentItem | undefined;
  ally: boolean;
  isSelf?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "h-8 w-8" : "h-6 w-6";
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        className={`${box} shrink-0 overflow-hidden rounded-md border-2 bg-raised ${
          ally ? "border-ally/70" : "border-enemy/70"
        } ${isSelf ? "ring-2 ring-white/80" : ""}`}
      >
        {agent?.icon && <img src={agent.icon} alt="" className="h-full w-full object-cover" />}
      </span>
      <span
        className={`truncate font-medium ${ally ? "text-ally" : "text-enemy"} ${isSelf ? "!text-white" : ""}`}
      >
        {label}
      </span>
    </span>
  );
}
