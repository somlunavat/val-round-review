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
            <header className="mb-2 flex items-baseline justify-between">
              <h3
                className={`font-display text-sm font-bold uppercase tracking-wider ${ally ? "text-ally" : "text-enemy"}`}
              >
                {ally ? "Your team" : "Enemy team"}
              </h3>
              <span className="text-xs text-muted">
                {known.length ? `${buyType(avg)} · ` : ""}
                <span className="font-display font-semibold tabular text-soft">
                  {total.toLocaleString()}
                </span>{" "}
                loadout
              </span>
            </header>
            <ul className="space-y-1">
              {team.map((p) => {
                const e = byPuuid.get(p.puuid);
                const weapon = lookup.weapon(e?.weapon);
                const armor = lookup.armor(e?.armor);
                const info = player(p.puuid);
                return (
                  <li
                    key={p.puuid}
                    className={`grid grid-cols-[minmax(0,1fr)_5.5rem_3.5rem] items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                      p.isSelf ? "bg-raised" : "bg-surface/60"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-6 w-6 shrink-0 overflow-hidden rounded border bg-raised ${ally ? "border-ally/60" : "border-enemy/60"}`}
                      >
                        {info.agentIcon && (
                          <img src={info.agentIcon} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span
                        className={`truncate ${p.isSelf ? "font-semibold text-white" : "text-soft"}`}
                      >
                        {info.label}
                      </span>
                      {afk.includes(p.puuid) && (
                        <span className="rounded bg-spike-dim px-1.5 text-[10px] font-semibold text-spike">
                          AFK
                        </span>
                      )}
                    </span>
                    {e ? (
                      <>
                        <span
                          className="flex items-center gap-1.5"
                          title={`${itemName(weapon, e.weapon)} · ${itemName(armor, e.armor)}`}
                        >
                          {weapon?.icon ? (
                            <img
                              src={weapon.icon}
                              alt={weapon.name}
                              className="h-4 max-w-16 object-contain"
                            />
                          ) : (
                            <span className="truncate text-xs text-soft">
                              {itemName(weapon, e.weapon)}
                            </span>
                          )}
                          {e.armor && <ArmorPip heavy={/heavy/i.test(armor?.name ?? "")} />}
                        </span>
                        <span className="text-right font-display font-semibold tabular text-white">
                          {e.loadoutValue.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="col-span-2 text-right text-xs text-muted">
                        No economy data
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted">
        Loadout is the value of what each player held this round. Buy labels use average loadout
        (≥3900 full, ≥2000 half, ≥1000 light, otherwise eco).
      </p>
    </div>
  );
}

function ArmorPip({ heavy }: { heavy: boolean }) {
  return (
    <span
      title={heavy ? "Heavy armor" : "Light armor"}
      className={`ml-auto inline-block h-3.5 w-3 shrink-0 rounded-b-full rounded-t-sm border ${
        heavy ? "border-sky-300 bg-sky-400/70" : "border-sky-300/70 bg-transparent"
      }`}
    />
  );
}
