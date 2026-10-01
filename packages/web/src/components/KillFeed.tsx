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

const ALLY_RGB = "69 224 189";
const ENEMY_RGB = "255 70 85";

/** In-game style kill feed: killer left, weapon, victim right, tinted by side. */
export function KillFeed({ events, t, player, weaponIcon, onSeek }: Props) {
  if (events.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No events recorded this round.</p>;
  }
  return (
    <ol className="space-y-1">
      {events.map((e, i) => {
        const past = e.t <= t;
        const current = e.t === t;
        return (
          <li key={i} className="flex items-stretch gap-2">
            <span
              className={`flex w-10 shrink-0 items-center justify-end font-cond text-xs font-bold tabular ${
                current ? "text-bone" : "text-muted"
              }`}
            >
              {formatRoundTime(e.t)}
            </span>
            <button
              type="button"
              onClick={() => onSeek(e.t)}
              className={`flex min-w-0 flex-1 items-center gap-2 border-l-2 px-2 py-1.5 text-left transition ${
                current ? "border-bone" : "border-transparent"
              } ${past ? "opacity-100" : "opacity-40 hover:opacity-75"}`}
              style={rowStyle(e, player)}
            >
              <EventBody event={e} player={player} weaponIcon={weaponIcon} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function rowStyle(e: RoundEvent, player: Props["player"]) {
  if (e.type !== "kill") return { background: "rgb(236 232 225 / 0.04)" };
  const a = player(e.killer).ally ? ALLY_RGB : ENEMY_RGB;
  const b = player(e.victim).ally ? ALLY_RGB : ENEMY_RGB;
  return {
    background: `linear-gradient(90deg, rgb(${a} / 0.22), rgb(15 25 35 / 0.6) 45%, rgb(15 25 35 / 0.6) 55%, rgb(${b} / 0.22))`,
  };
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
      <>
        <Agent info={killer} />
        <Name info={killer} />
        <span
          className="mx-auto flex h-5 w-16 shrink-0 items-center justify-center"
          title={weapon?.name}
        >
          {weapon?.icon ? (
            <img src={weapon.icon} alt={weapon.name} className="max-h-4 max-w-16" />
          ) : (
            <span className="font-cond text-xs text-muted">▶</span>
          )}
        </span>
        <Name info={victim} right />
        <Agent info={victim} dead />
      </>
    );
  }
  const who = player(e.type === "plant" ? e.planter : e.defuser);
  return (
    <>
      {e.type === "plant" ? (
        <SpikeIcon size={16} className="shrink-0 text-spike" />
      ) : (
        <DefuseIcon size={16} className="shrink-0 text-sky-300" />
      )}
      <Agent info={who} />
      <Name info={who} />
      <span className="ml-auto font-cond text-xs font-bold uppercase tracking-[0.15em] text-soft">
        {e.type === "plant" ? `Planted · ${e.site}` : "Defused"}
      </span>
    </>
  );
}

function Agent({ info, dead }: { info: PlayerInfo; dead?: boolean }) {
  return (
    <span className="h-6 w-6 shrink-0 overflow-hidden bg-ink">
      {info.agentIcon && (
        <img
          src={info.agentIcon}
          alt=""
          className={`h-full w-full object-cover ${dead ? "grayscale" : ""}`}
        />
      )}
    </span>
  );
}

function Name({ info, right }: { info: PlayerInfo; right?: boolean }) {
  return (
    <span
      className={`min-w-0 truncate font-cond text-sm font-bold uppercase tracking-wide ${right ? "text-right" : ""} ${
        info.isSelf ? "text-bone" : info.ally ? "text-ally" : "text-red"
      }`}
    >
      {info.label}
    </span>
  );
}
