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
          <table key={side} className="w-full text-sm">
            <caption
              className={`mb-2 text-left font-display text-sm font-bold uppercase tracking-wider ${ally ? "text-ally" : "text-enemy"}`}
            >
              {ally ? "Your team" : "Enemy team"}
            </caption>
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-1 text-left font-medium">Agent</th>
                <th className="pb-1 text-right font-medium">K</th>
                <th className="pb-1 text-right font-medium">D</th>
                <th className="pb-1 text-right font-medium">A</th>
                <th className="pb-1 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="font-display tabular">
              {team.map((p) => {
                const info = player(p.puuid);
                return (
                  <tr key={p.puuid} className={p.isSelf ? "bg-raised" : ""}>
                    <td className="py-1.5 pl-1 font-sans">
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-6 w-6 shrink-0 overflow-hidden rounded border bg-raised ${ally ? "border-ally/60" : "border-enemy/60"}`}
                        >
                          {info.agentIcon && (
                            <img
                              src={info.agentIcon}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span className={p.isSelf ? "font-semibold text-white" : "text-soft"}>
                          {info.label}
                        </span>
                      </span>
                    </td>
                    <td className="text-right font-semibold text-white">{p.stats?.kills ?? "–"}</td>
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
