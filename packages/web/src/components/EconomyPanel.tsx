import type { EconomyEntry, ReplayPlayer, TeamSide } from "@replay-lab/shared";
import { itemLabel } from "../replay/select.js";

type Props = {
  economy: EconomyEntry[];
  players: ReplayPlayer[];
  selfTeam: TeamSide | undefined;
  labelOf: (puuid: string) => string;
  afk: string[];
};

export function EconomyPanel({ economy, players, selfTeam, labelOf, afk }: Props) {
  const byPuuid = new Map(economy.map((e) => [e.puuid, e]));
  const sides = selfTeam
    ? [selfTeam, selfTeam === "Blue" ? "Red" : "Blue"]
    : (["Blue", "Red"] as const);

  return (
    <div className="space-y-4">
      {sides.map((side) => {
        const team = players.filter((p) => p.team === side);
        const total = team.reduce((sum, p) => sum + (byPuuid.get(p.puuid)?.loadoutValue ?? 0), 0);
        return (
          <table key={side} className="w-full text-sm">
            <caption
              className={`mb-1 text-left font-medium ${side === selfTeam ? "text-teal-400" : "text-red-400"}`}
            >
              {side === selfTeam ? "Your team" : "Enemy team"} · loadout {total.toLocaleString()}
            </caption>
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="text-left font-normal">Player</th>
                <th className="text-left font-normal">Weapon</th>
                <th className="text-left font-normal">Armor</th>
                <th className="text-right font-normal">Loadout</th>
                <th className="text-right font-normal">Spent</th>
                <th className="text-right font-normal">Left</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {team.map((p) => {
                const e = byPuuid.get(p.puuid);
                return (
                  <tr key={p.puuid} className={p.isSelf ? "text-white" : "text-neutral-300"}>
                    <td>
                      {labelOf(p.puuid)}
                      {afk.includes(p.puuid) && (
                        <span className="ml-1 text-xs text-yellow-400">AFK</span>
                      )}
                    </td>
                    {e ? (
                      <>
                        <td>{itemLabel(e.weapon)}</td>
                        <td>{itemLabel(e.armor)}</td>
                        <td className="text-right">{e.loadoutValue.toLocaleString()}</td>
                        <td className="text-right">{e.spent.toLocaleString()}</td>
                        <td className="text-right">{e.remaining.toLocaleString()}</td>
                      </>
                    ) : (
                      <td colSpan={5} className="text-neutral-500">
                        No economy data
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}
