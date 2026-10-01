import type { MatchReplay, RoundEvent, RoundReplay, Snapshot, TeamSide } from "@replay-lab/shared";

/**
 * The latest known snapshot at or before `t`. No interpolation: between
 * snapshots the view holds the last known positions and says so.
 */
export function snapshotAt(round: RoundReplay, t: number): Snapshot | undefined {
  let found: Snapshot | undefined;
  for (const s of round.snapshots) {
    if (s.t <= t) found = s;
    else break;
  }
  return found;
}

type KillEvent = Extract<RoundEvent, { type: "kill" }>;

/** Kill events recorded at exactly this snapshot's time. */
export function killsAtSnapshot(round: RoundReplay, snap: Snapshot): KillEvent[] {
  if (snap.source !== "kill") return [];
  return round.events.filter((e): e is KillEvent => e.type === "kill" && e.t === snap.t);
}

/** Spike plant visible at `t` (planted at or before `t`). */
export function plantAt(round: RoundReplay, t: number) {
  return round.events.find(
    (e): e is Extract<RoundEvent, { type: "plant" }> => e.type === "plant" && e.t <= t,
  );
}

/** Where the scrubber's range ends: never before the last event. */
export function timelineEnd(round: RoundReplay): number {
  return Math.max(round.durationMs, round.events.at(-1)?.t ?? 0, 1);
}

export function formatRoundTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Stable, anonymous labels: "You", "Ally 1..4", "Enemy 1..5". The API's names
 * are never sent to the browser.
 */
export function playerLabels(replay: MatchReplay): Map<string, string> {
  const selfTeam = replay.players.find((p) => p.isSelf)?.team;
  const labels = new Map<string, string>();
  let ally = 0;
  let enemy = 0;
  for (const p of replay.players) {
    if (p.isSelf) labels.set(p.puuid, "You");
    else if (p.team === selfTeam) labels.set(p.puuid, `Ally ${++ally}`);
    else labels.set(p.puuid, `Enemy ${++enemy}`);
  }
  return labels;
}

export function selfTeam(replay: MatchReplay): TeamSide | undefined {
  return replay.players.find((p) => p.isSelf)?.team;
}

/** The post-plant window on the timeline, if the spike was planted. */
export function plantWindow(
  round: RoundReplay,
  end: number,
): { from: number; to: number } | undefined {
  const plant = round.events.find((e) => e.type === "plant");
  if (!plant) return undefined;
  const stop = round.events.find((e) => e.type === "defuse");
  return { from: plant.t, to: stop?.t ?? end };
}

/** Players killed at or before `t` this round (known from kill events). */
export function deadBy(round: RoundReplay, t: number): Set<string> {
  const dead = new Set<string>();
  for (const e of round.events) if (e.type === "kill" && e.t <= t) dead.add(e.victim);
  return dead;
}
