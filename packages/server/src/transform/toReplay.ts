/**
 * Raw Riot match -> derived replay model.
 *
 * Pure functions only. Snapshots carry known positions exactly as reported at
 * kill/plant/defuse events; nothing here interpolates or invents a position.
 * See docs/DATA_MODEL.md for what is derived and how.
 */
import type {
  Kill,
  Match,
  MatchReplay,
  MatchSummary,
  PlayerLocations,
  PlayerStatLine,
  ReplayPlayer,
  RoundEvent,
  RoundReplay,
  RoundResult,
  Snapshot,
  SnapshotPlayer,
  TeamSide,
} from "@replay-lab/shared";

/** Standard round timer, used only when a round ends on the timer. */
export const ROUND_TIMER_MS = 100_000;
/** Spike fuse, used only to place the end of a detonation round. */
export const SPIKE_FUSE_MS = 45_000;

function statLine(p: Match["players"][number]): PlayerStatLine | undefined {
  if (!p.stats) return undefined;
  const { kills, deaths, assists, score } = p.stats;
  return { kills, deaths, assists, score };
}

export class NotParticipantError extends Error {
  constructor(matchId: string) {
    super(`Player is not a participant in match ${matchId}`);
    this.name = "NotParticipantError";
  }
}

function toSide(teamId: string): TeamSide | undefined {
  return teamId === "Blue" || teamId === "Red" ? teamId : undefined;
}

function teamsByPuuid(match: Match): Map<string, TeamSide> {
  const teams = new Map<string, TeamSide>();
  for (const p of match.players) {
    const side = toSide(p.teamId);
    if (side) teams.set(p.puuid, side);
  }
  return teams;
}

function sortedKills(round: RoundResult): Kill[] {
  return round.playerStats
    .flatMap((ps) => ps.kills ?? [])
    .sort(
      (a, b) =>
        a.timeSinceRoundStartMillis - b.timeSinceRoundStartMillis ||
        a.timeSinceGameStartMillis - b.timeSinceGameStartMillis,
    );
}

function snapshotPlayers(
  locations: readonly PlayerLocations[],
  teams: ReadonlyMap<string, TeamSide>,
  deadBefore: ReadonlySet<string>,
): SnapshotPlayer[] {
  const players: SnapshotPlayer[] = [];
  for (const loc of locations) {
    const team = teams.get(loc.puuid);
    if (!team) continue;
    players.push({
      puuid: loc.puuid,
      team,
      pos: { x: loc.location.x, y: loc.location.y },
      ...(typeof loc.viewRadians === "number" ? { facing: loc.viewRadians } : {}),
      alive: !deadBefore.has(loc.puuid),
    });
  }
  return players;
}

/** Victims of kills strictly before `t`. */
function deadBefore(kills: readonly Kill[], t: number): Set<string> {
  return new Set(kills.filter((k) => k.timeSinceRoundStartMillis < t).map((k) => k.victim));
}

function wasPlanted(round: RoundResult): boolean {
  return Boolean(round.bombPlanter) && typeof round.plantRoundTime === "number";
}

function wasDefused(round: RoundResult): boolean {
  return Boolean(round.bombDefuser) && typeof round.defuseRoundTime === "number";
}

/**
 * The API has no round end time. This is the latest moment we can justify from
 * the data, so it is a lower bound rather than a measurement.
 */
export function deriveDurationMs(round: RoundResult, events: readonly RoundEvent[]): number {
  const lastEvent = events.reduce((max, e) => Math.max(max, e.t), 0);
  if (round.roundResult === "Bomb detonated" && wasPlanted(round)) {
    return Math.max(lastEvent, (round.plantRoundTime ?? 0) + SPIKE_FUSE_MS);
  }
  if (round.roundResult === "Round timer expired") {
    return Math.max(lastEvent, ROUND_TIMER_MS);
  }
  return lastEvent;
}

export function toRoundReplay(
  round: RoundResult,
  teams: ReadonlyMap<string, TeamSide>,
): RoundReplay {
  const kills = sortedKills(round);
  const events: RoundEvent[] = [];
  const snapshots: Snapshot[] = [];

  for (const k of kills) {
    const t = k.timeSinceRoundStartMillis;
    const victimPos = { x: k.victimLocation.x, y: k.victimLocation.y };
    events.push({
      type: "kill",
      t,
      ...(k.killer ? { killer: k.killer } : {}),
      victim: k.victim,
      ...(k.finishingDamage?.damageItem ? { weapon: k.finishingDamage.damageItem } : {}),
      victimPos,
    });

    const dead = deadBefore(kills, t);
    const players = snapshotPlayers(
      (k.playerLocations ?? []).filter((l) => l.puuid !== k.victim),
      teams,
      dead,
    );
    // The victim's death spot is reported separately and is the more precise source.
    const victimTeam = teams.get(k.victim);
    if (victimTeam) {
      const listed = k.playerLocations?.find((l) => l.puuid === k.victim);
      players.push({
        puuid: k.victim,
        team: victimTeam,
        pos: victimPos,
        ...(typeof listed?.viewRadians === "number" ? { facing: listed.viewRadians } : {}),
        alive: false,
      });
    }
    snapshots.push({ t, source: "kill", players });
  }

  if (wasPlanted(round)) {
    const t = round.plantRoundTime ?? 0;
    events.push({
      type: "plant",
      t,
      planter: round.bombPlanter ?? "",
      site: round.plantSite || "?",
      ...(round.plantLocation
        ? { pos: { x: round.plantLocation.x, y: round.plantLocation.y } }
        : {}),
    });
    if (round.plantPlayerLocations) {
      snapshots.push({
        t,
        source: "plant",
        players: snapshotPlayers(round.plantPlayerLocations, teams, deadBefore(kills, t)),
      });
    }
  }

  if (wasDefused(round)) {
    const t = round.defuseRoundTime ?? 0;
    events.push({ type: "defuse", t, defuser: round.bombDefuser ?? "" });
    if (round.defusePlayerLocations) {
      snapshots.push({
        t,
        source: "defuse",
        players: snapshotPlayers(round.defusePlayerLocations, teams, deadBefore(kills, t)),
      });
    }
  }

  events.sort((a, b) => a.t - b.t);
  snapshots.sort((a, b) => a.t - b.t);

  const economy = round.playerStats.flatMap((ps) =>
    ps.economy
      ? [
          {
            puuid: ps.puuid,
            loadoutValue: ps.economy.loadoutValue,
            spent: ps.economy.spent,
            remaining: ps.economy.remaining,
            ...(ps.economy.weapon ? { weapon: ps.economy.weapon } : {}),
            ...(ps.economy.armor ? { armor: ps.economy.armor } : {}),
          },
        ]
      : [],
  );

  return {
    roundNum: round.roundNum,
    winningTeam: round.winningTeam,
    resultType: round.roundResult,
    durationMs: deriveDurationMs(round, events),
    economy,
    snapshots,
    events,
    afk: round.playerStats.filter((ps) => ps.wasAfk === true).map((ps) => ps.puuid),
  };
}

function assertParticipant(match: Match, selfPuuid: string): TeamSide {
  const self = match.players.find((p) => p.puuid === selfPuuid);
  const side = self && toSide(self.teamId);
  if (!side) throw new NotParticipantError(match.matchInfo.matchId);
  return side;
}

export function toMatchReplay(match: Match, selfPuuid: string): MatchReplay {
  assertParticipant(match, selfPuuid);
  const teams = teamsByPuuid(match);
  const players: ReplayPlayer[] = match.players.flatMap((p) => {
    const team = teams.get(p.puuid);
    if (!team) return [];
    return [
      {
        puuid: p.puuid,
        team,
        ...(p.characterId ? { characterId: p.characterId } : {}),
        isSelf: p.puuid === selfPuuid,
        ...(statLine(p) ? { stats: statLine(p) } : {}),
      },
    ];
  });

  return {
    matchId: match.matchInfo.matchId,
    mapId: match.matchInfo.mapId,
    gameStartMillis: match.matchInfo.gameStartMillis,
    selfPuuid,
    players,
    rounds: [...match.roundResults]
      .sort((a, b) => a.roundNum - b.roundNum)
      .map((r) => toRoundReplay(r, teams)),
  };
}

export function toMatchSummary(match: Match, selfPuuid: string): MatchSummary {
  const selfTeam = assertParticipant(match, selfPuuid);
  const self = match.players.find((p) => p.puuid === selfPuuid);
  const roundsWon = match.roundResults.filter((r) => r.winningTeam === selfTeam).length;
  const roundsLost = match.roundResults.length - roundsWon;
  const teamWon = match.teams?.find((t) => t.teamId === selfTeam)?.won;
  return {
    matchId: match.matchInfo.matchId,
    mapId: match.matchInfo.mapId,
    gameStartMillis: match.matchInfo.gameStartMillis,
    ...(match.matchInfo.queueId ? { queueId: match.matchInfo.queueId } : {}),
    selfTeam,
    ...(self?.characterId ? { selfCharacterId: self.characterId } : {}),
    ...(self && statLine(self) ? { selfStats: statLine(self) } : {}),
    roundsWon,
    roundsLost,
    won: teamWon ?? roundsWon > roundsLost,
  };
}
