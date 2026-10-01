import type { ReplayPlayer, TeamSide } from "@replay-lab/shared";
import type { PlayerInfo } from "./playerInfo.js";

type Props = {
  players: ReplayPlayer[];
  selfTeam: TeamSide | undefined;
  player: (puuid: string) => PlayerInfo;
};

/** Match totals from the API's per-player stats. */
export function Scoreboard({ players, selfTeam, player }: Props) {
  const other: TeamSide = selfTeam === "Red" ? "Blue" : "Red";
  const sides: TeamSide[] = selfTeam ? [selfTeam, other] : ["Blue", "Red"];
  return (
    <div className="space-y-5">
      {sides.map((side) => {
        const ally = side === selfTeam;
        const team = players
          .filter((p) => p.team === side)
          .sort((a, b) => (b.stats?.score ?? 0) - (a.stats?.score ?? 0));
        return (
          <table key={side} className="w-full">
            <caption
              className={`mb-1.5 border-b-2 pb-1 text-left font-display text-xl leading-none tracking-wide ${
                ally ? "border-ally text-ally" : "border-red text-red"
              }`}
            >
              {ally ? "Your team" : "Enemy team"}
            </caption>
            <thead>
              <tr className="hud-label">
                <th className="py-1 text-left font-semibold">Agent</th>
                <th className="w-12 text-right font-semibold">K</th>
                <th className="w-12 text-right font-semibold">D</th>
                <th className="w-12 text-right font-semibold">A</th>
                <th className="w-16 pr-1 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody className="font-cond text-base font-bold tabular">
              {team.map((p) => {
                const info = player(p.puuid);
                return (
                  <tr
                    key={p.puuid}
                    className={`border-b border-line/60 ${p.isSelf ? "bg-bone/[0.06]" : ""}`}
                  >
                    <td className="py-1.5 pl-1">
                      <span className="flex items-center gap-2">
                        <span className="h-7 w-7 shrink-0 overflow-hidden bg-ink">
                          {info.agentIcon && (
                            <img
                              src={info.agentIcon}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span
                          className={`text-sm uppercase tracking-wide ${p.isSelf ? "text-bone" : "text-soft"}`}
                        >
                          {info.label}
                        </span>
                      </span>
                    </td>
                    <td className="text-right text-bone">{p.stats?.kills ?? "–"}</td>
                    <td className="text-right text-soft">{p.stats?.deaths ?? "–"}</td>
                    <td className="text-right text-soft">{p.stats?.assists ?? "–"}</td>
                    <td className="pr-1 text-right text-soft">{p.stats?.score ?? "–"}</td>
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
