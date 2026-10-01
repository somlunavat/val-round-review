import type { RoundEvent } from "@replay-lab/shared";
import { formatRoundTime } from "../replay/select.js";
import { DefuseIcon, SpikeIcon } from "./Icons.js";
import type { PlayerInfo } from "./playerInfo.js";

type Props = {
  events: RoundEvent[];
  t: number;
  player: (puuid: string | undefined) => PlayerInfo;
  weaponIcon: (id: string | undefined) => { name: string; icon?: string } | undefined;
  onSeek: (t: number) => void;
};

export function KillFeed({ events, t, player, weaponIcon, onSeek }: Props) {
  if (events.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-sm text-muted">No events recorded this round.</p>
    );
  }
  return (
    <ol className="space-y-1">
      {events.map((e, i) => {
        const past = e.t <= t;
        const current = e.t === t;
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSeek(e.t)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                current
                  ? "border-white/40 bg-raised"
                  : past
                    ? "border-transparent bg-surface/60 hover:bg-raised"
                    : "border-transparent opacity-45 hover:opacity-80"
              }`}
            >
              <span className="w-9 shrink-0 font-display text-xs font-semibold tabular text-muted">
                {formatRoundTime(e.t)}
              </span>
              <EventBody event={e} player={player} weaponIcon={weaponIcon} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function EventBody({
  event: e,
  player,
  weaponIcon,
}: {
  event: RoundEvent;
  player: Props["player"];
  weaponIcon: Props["weaponIcon"];
}) {
  if (e.type === "kill") {
    const killer = player(e.killer);
    const victim = player(e.victim);
    const weapon = weaponIcon(e.weapon);
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Name info={killer} />
        <span className="flex h-5 w-14 shrink-0 items-center justify-center" title={weapon?.name}>
          {weapon?.icon ? (
            <img
              src={weapon.icon}
              alt={weapon.name}
              className="max-h-4 max-w-14 opacity-90 invert-0"
            />
          ) : (
            <span className="text-muted">→</span>
          )}
        </span>
        <Name info={victim} struck />
      </span>
    );
  }
  if (e.type === "plant") {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <SpikeIcon size={16} className="shrink-0 text-spike" />
        <Name info={player(e.planter)} />
        <span className="text-soft">planted on {e.site}</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <DefuseIcon size={16} className="shrink-0 text-sky-400" />
      <Name info={player(e.defuser)} />
      <span className="text-soft">defused</span>
    </span>
  );
}

function Name({ info, struck }: { info: PlayerInfo; struck?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className={`h-5 w-5 shrink-0 overflow-hidden rounded border ${info.ally ? "border-ally/70" : "border-enemy/70"} bg-raised`}
      >
        {info.agentIcon && (
          <img
            src={info.agentIcon}
            alt=""
            className={`h-full w-full object-cover ${struck ? "grayscale" : ""}`}
          />
        )}
      </span>
      <span
        className={`truncate font-medium ${info.isSelf ? "text-white" : info.ally ? "text-ally" : "text-enemy"} ${
          struck ? "opacity-70" : ""
        }`}
      >
        {info.label}
      </span>
    </span>
  );
}
