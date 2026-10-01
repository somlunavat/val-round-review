import type { EconomyEntry, ReplayPlayer, TeamSide } from "@replay-lab/shared";
import type { ContentLookup } from "../content/lookup.js";
import { itemName } from "../content/lookup.js";
import type { PlayerInfo } from "./playerInfo.js";

type Props = {
  economy: EconomyEntry[];
  players: ReplayPlayer[];
  selfTeam: TeamSide | undefined;
  player: (puuid: string) => PlayerInfo;
  lookup: ContentLookup;
  afk: string[];
};

/** Labels a team's buy from average loadout value. Thresholds are rough rules of thumb. */
function buyType(avg: number): string {
  if (avg >= 3900) return "Full buy";
  if (avg >= 2000) return "Half buy";
  if (avg >= 1000) return "Light buy";
  return "Eco";
}

export function EconomyPanel({ economy, players, selfTeam, player, lookup, afk }: Props) {
  const byPuuid = new Map(economy.map((e) => [e.puuid, e]));
  const other: TeamSide = selfTeam === "Red" ? "Blue" : "Red";
  const sides: TeamSide[] = selfTeam ? [selfTeam, other] : ["Blue", "Red"];

  return (
    <div className="space-y-5">
      {sides.map((side) => {
        const team = players.filter((p) => p.team === side);
        const known = team.flatMap((p) => byPuuid.get(p.puuid) ?? []);
        const total = known.reduce((sum, e) => sum + e.loadoutValue, 0);
        const avg = known.length ? total / known.length : 0;
        const ally = side === selfTeam;
        return (
          <section key={side}>
            <header
              className={`mb-1.5 flex items-end justify-between border-b-2 pb-1 ${ally ? "border-ally" : "border-red"}`}
            >
              <h3
                className={`font-display text-xl leading-none tracking-wide ${ally ? "text-ally" : "text-red"}`}
              >
                {ally ? "Your team" : "Enemy team"}
              </h3>
              <span className="font-cond text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                {known.length ? `${buyType(avg)} · ` : ""}
                <span className="text-bone tabular">{total.toLocaleString()}</span>
              </span>
            </header>
            <ul>
              {team.map((p) => {
                const e = byPuuid.get(p.puuid);
                const weapon = lookup.weapon(e?.weapon);
                const armor = lookup.armor(e?.armor);
                const info = player(p.puuid);
                return (
                  <li
                    key={p.puuid}
                    className={`grid grid-cols-[minmax(0,1fr)_5.5rem_1rem_3.5rem] items-center gap-2 border-b border-line/60 px-1 py-1.5 ${
                      p.isSelf ? "bg-bone/[0.06]" : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-7 w-7 shrink-0 overflow-hidden bg-ink">
                        {info.agentIcon && (
                          <img src={info.agentIcon} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span
                        className={`truncate font-cond text-sm font-bold uppercase tracking-wide ${p.isSelf ? "text-bone" : "text-soft"}`}
                      >
                        {info.label}
                      </span>
                      {afk.includes(p.puuid) && (
                        <span className="bg-spike px-1 font-cond text-[10px] font-bold uppercase text-ink">
                          AFK
                        </span>
                      )}
                    </span>
                    {e ? (
                      <>
                        <span className="flex h-5 items-center" title={itemName(weapon, e.weapon)}>
                          {weapon?.icon ? (
                            <img
                              src={weapon.icon}
                              alt={weapon.name}
                              className="max-h-4 max-w-20 object-contain"
                            />
                          ) : (
                            <span className="truncate font-cond text-xs uppercase text-soft">
                              {itemName(weapon, e.weapon)}
                            </span>
                          )}
                        </span>
                        <ArmorMark name={armor?.name} present={Boolean(e.armor)} />
                        <span className="text-right font-cond text-base font-bold tabular text-bone">
                          {e.loadoutValue.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="col-span-3 text-right font-cond text-xs uppercase tracking-wider text-muted">
                        No data
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs leading-relaxed text-muted">
        Loadout = value held this round. Buy type from team average: ≥3900 full, ≥2000 half, ≥1000
        light, else eco.
      </p>
    </div>
  );
}

function ArmorMark({ name, present }: { name: string | undefined; present: boolean }) {
  if (!present) return <span />;
  const heavy = /heavy/i.test(name ?? "");
  return (
    <svg viewBox="0 0 12 14" className="h-3.5 w-3" aria-label={name ?? "Armor"}>
      <title>{name ?? "Armor"}</title>
      <path
        d="M6 1 11 3v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V3z"
        fill={heavy ? "var(--color-bone)" : "none"}
        stroke="var(--color-bone)"
        strokeWidth="1.4"
      />
    </svg>
  );
}
