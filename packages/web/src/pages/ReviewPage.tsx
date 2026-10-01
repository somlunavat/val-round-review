import { useEffect, useMemo } from "react";
import type { MatchReplay } from "@replay-lab/shared";
import { mapDisplayName } from "@replay-lab/shared";
import { EconomyPanel } from "../components/EconomyPanel.js";
import { MatchPicker } from "../components/MatchPicker.js";
import { Minimap2D } from "../components/Minimap2D.js";
import { Notice } from "../components/Notice.js";
import { RoundPicker } from "../components/RoundPicker.js";
import { Timeline } from "../components/Timeline.js";
import { mapConfigFor } from "../maps/index.js";
import {
  formatRoundTime,
  killsAtSnapshot,
  plantAt,
  playerLabels,
  selfTeam as selfTeamOf,
  snapshotAt,
  timelineEnd,
} from "../replay/select.js";
import { useReview } from "../state/store.js";

export function ReviewPage() {
  const { matches, replay, selectedMatchId, loadMatches, selectMatch } = useReview();

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Your matches
        </h2>
        {matches.status === "loading" && <Notice>Loading matches…</Notice>}
        {matches.status === "error" && <Notice tone="error">{matches.message}</Notice>}
        {matches.status === "ready" && (
          <MatchPicker
            matches={matches.data}
            selected={selectedMatchId}
            onSelect={(id) => void selectMatch(id)}
          />
        )}
      </aside>
      <section className="min-w-0">
        {replay.status === "idle" && <Notice>Pick a match to review.</Notice>}
        {replay.status === "loading" && <Notice>Loading match…</Notice>}
        {replay.status === "error" && <Notice tone="error">{replay.message}</Notice>}
        {replay.status === "ready" && <MatchReview replay={replay.data} />}
      </section>
    </div>
  );
}

function MatchReview({ replay }: { replay: MatchReplay }) {
  const { roundIndex, t, showCalibration, selectRound, setTime, toggleCalibration } = useReview();
  const labels = useMemo(() => playerLabels(replay), [replay]);
  const teams = useMemo(() => new Map(replay.players.map((p) => [p.puuid, p.team])), [replay]);
  const selfTeam = selfTeamOf(replay);
  const map = mapConfigFor(replay.mapId);
  const round = replay.rounds[roundIndex];

  if (!round) return <Notice tone="error">This match has no rounds.</Notice>;

  const snapshot = snapshotAt(round, t);
  const end = timelineEnd(round);
  const labelOf = (puuid: string | undefined) =>
    puuid ? (labels.get(puuid) ?? "Unknown") : "Unknown";

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          {mapDisplayName(replay.mapId)} · Round {round.roundNum + 1}{" "}
          <span className={round.winningTeam === selfTeam ? "text-teal-400" : "text-red-400"}>
            {round.winningTeam === selfTeam ? "won" : "lost"}
          </span>{" "}
          <span className="text-sm font-normal text-neutral-400">({round.resultType})</span>
        </h2>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={showCalibration} onChange={toggleCalibration} />
          Calibration grid
        </label>
      </div>

      <RoundPicker
        rounds={replay.rounds}
        selected={roundIndex}
        selfTeam={selfTeam}
        onSelect={selectRound}
      />

      <div className="grid gap-6 xl:grid-cols-[auto_1fr]">
        <div className="space-y-2">
          <SnapshotStatus snapshotT={snapshot?.t} source={snapshot?.source} t={t} />
          {map ? (
            <Minimap2D
              map={map}
              snapshot={snapshot}
              stale={snapshot !== undefined && snapshot.t < t}
              kills={snapshot ? killsAtSnapshot(round, snapshot) : []}
              plant={plantAt(round, t)}
              selfPuuid={replay.selfPuuid}
              selfTeam={selfTeam}
              labels={labels}
              showCalibration={showCalibration}
            />
          ) : (
            <Notice tone="error">No minimap calibration for this map yet.</Notice>
          )}
          <Legend />
        </div>
        <div className="min-w-0 space-y-6">
          <Timeline
            events={round.events}
            end={end}
            t={t}
            onSeek={setTime}
            teamOf={(p) => teams.get(p)}
            selfTeam={selfTeam}
            labelOf={labelOf}
          />
          <EconomyPanel
            economy={round.economy}
            players={replay.players}
            selfTeam={selfTeam}
            labelOf={labelOf}
            afk={round.afk}
          />
        </div>
      </div>
    </div>
  );
}

/** Says exactly which moment the dots come from, so nothing reads as a live trace. */
function SnapshotStatus({
  snapshotT,
  source,
  t,
}: {
  snapshotT?: number;
  source?: string;
  t: number;
}) {
  if (snapshotT === undefined) {
    return (
      <Notice>
        No positions known yet. The API only reports positions at kills, spike plants, and defuses.
      </Notice>
    );
  }
  if (snapshotT < t) {
    return (
      <Notice>
        Showing last known positions from {formatRoundTime(snapshotT)} ({source}). Where players are
        at {formatRoundTime(t)} is unknown.
      </Notice>
    );
  }
  return (
    <Notice>
      Known positions at {formatRoundTime(snapshotT)} ({source}).
    </Notice>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
      <span>
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-teal-400" />
        Your team
      </span>
      <span>
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
        Enemy
      </span>
      <span>✕ dead</span>
      <span>
        <span className="mr-1 inline-block h-2.5 w-2.5 rotate-45 bg-yellow-400" />
        Spike
      </span>
      <span>Line: killer → victim</span>
    </div>
  );
}
