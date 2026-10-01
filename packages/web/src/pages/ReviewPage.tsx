import { useCallback, useEffect, useMemo } from "react";
import type { MatchReplay, RoundEvent, RoundReplay } from "@replay-lab/shared";
import { mapDisplayName } from "@replay-lab/shared";
import { EconomyPanel } from "../components/EconomyPanel.js";
import { ResultIcon } from "../components/Icons.js";
import { KillFeed } from "../components/KillFeed.js";
import { CameraPanel, ViewSwitch } from "../components/CameraPanel.js";
import { MapView } from "../components/MapView.js";
import { MatchList } from "../components/MatchList.js";
import { Notice, Skeleton } from "../components/Notice.js";
import type { PlayerInfo } from "../components/playerInfo.js";
import { RoundStrip } from "../components/RoundStrip.js";
import { Scoreboard } from "../components/Scoreboard.js";
import { Scrubber } from "../components/Scrubber.js";
import { mapConfigFor } from "../maps/index.js";
import { Map3D } from "../three/Map3D.js";
import {
  formatRoundTime,
  killsAtSnapshot,
  plantAt,
  plantWindow,
  playerLabels,
  selfTeam as selfTeamOf,
  snapshotAt,
  timelineEnd,
} from "../replay/select.js";
import { useReview, type SidePanel } from "../state/store.js";

export function ReviewPage() {
  const { matches, replay, selectedMatchId, lookup, selectMatch, loadMatches } = useReview();

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Your matches
        </h2>
        {(matches.status === "loading" || matches.status === "idle") && (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {matches.status === "error" && (
          <Notice tone="error" title="Couldn't load your matches">
            <p>{matches.message}</p>
            <button
              type="button"
              onClick={() => void loadMatches()}
              className="mt-2 rounded-md border border-enemy/50 px-2 py-1 text-xs font-medium hover:bg-enemy/20"
            >
              Try again
            </button>
          </Notice>
        )}
        {matches.status === "ready" && (
          <MatchList
            matches={matches.data}
            selected={selectedMatchId}
            lookup={lookup}
            onSelect={(id) => void selectMatch(id)}
          />
        )}
      </aside>

      <section className="min-w-0">
        {replay.status === "idle" && matches.status === "ready" && (
          <Notice>Pick a match to review.</Notice>
        )}
        {replay.status === "loading" && (
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-16" />
            <Skeleton className="aspect-square max-w-[760px]" />
          </div>
        )}
        {replay.status === "error" && (
          <Notice tone="error" title="Couldn't load this match">
            {replay.message}
          </Notice>
        )}
        {replay.status === "ready" && <MatchReview replay={replay.data} />}
      </section>
    </div>
  );
}

function MatchReview({ replay }: { replay: MatchReplay }) {
  const state = useReview();
  const { roundIndex, t, playing, speed, lookup, setTime, setPlaying, selectRound } = state;
  const selfTeam = selfTeamOf(replay);
  const map = mapConfigFor(replay.mapId);
  const round = replay.rounds[roundIndex];
  const end = round ? timelineEnd(round) : 0;

  const fallback = useMemo(() => playerLabels(replay), [replay]);
  const byPuuid = useMemo(() => new Map(replay.players.map((p) => [p.puuid, p])), [replay]);

  const player = useCallback(
    (puuid: string | undefined): PlayerInfo => {
      const p = puuid ? byPuuid.get(puuid) : undefined;
      if (!p) return { label: "Unknown", ally: false, isSelf: false };
      const agent = lookup.agent(p.characterId);
      return {
        label: p.isSelf ? "You" : (agent?.name ?? fallback.get(p.puuid) ?? "Unknown"),
        ally: p.team === selfTeam,
        isSelf: p.isSelf,
        ...(agent?.icon ? { agentIcon: agent.icon } : {}),
        ...(agent?.name ? { agentName: agent.name } : {}),
      };
    },
    [byPuuid, lookup, fallback, selfTeam],
  );

  usePlayback(end);
  useShortcuts(round, replay.rounds.length);

  if (!round) return <Notice tone="error">This match has no rounds.</Notice>;

  const snapshot = snapshotAt(round, t);
  const plant = plantAt(round, t);
  const defused = round.events.some((e) => e.type === "defuse" && e.t <= t);
  const won = round.winningTeam === selfTeam;
  const describe = (e: RoundEvent) =>
    e.type === "kill"
      ? `${player(e.killer).label} killed ${player(e.victim).label}`
      : e.type === "plant"
        ? `${player(e.planter).label} planted on ${e.site}`
        : `${player(e.defuser).label} defused`;
  const minimapUrl = lookup.map(replay.mapId)?.minimap;
  const kills = snapshot ? killsAtSnapshot(round, snapshot) : [];

  return (
    <div className="space-y-5">
      <MatchHeader replay={replay} player={player} />

      <RoundStrip
        rounds={replay.rounds}
        selected={roundIndex}
        selfTeam={selfTeam}
        onSelect={selectRound}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-3">
          <div
            className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50 ${
              state.view === "3d"
                ? "aspect-[16/10] max-h-[calc(100vh-24rem)] min-h-[420px]"
                : "aspect-square max-w-[min(100%,max(440px,calc(100vh-27rem)))]"
            }`}
          >
            {!map ? (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
                No calibration for {mapDisplayName(replay.mapId)} yet.
              </div>
            ) : state.view === "3d" ? (
              <Map3D
                map={map}
                minimapUrl={minimapUrl}
                snapshot={snapshot}
                stale={snapshot !== undefined && snapshot.t < t}
                kills={kills}
                plant={plant}
                defused={defused}
                selfTeam={selfTeam}
                selfPuuid={replay.selfPuuid}
                labelOf={(puuid) => player(puuid).label}
                cameraMode={state.cameraMode}
                subject={state.pov.subject}
                target={state.pov.target}
                showCallouts={state.showCallouts}
              />
            ) : (
              <MapView
                map={map}
                minimapUrl={minimapUrl}
                snapshot={snapshot}
                stale={snapshot !== undefined && snapshot.t < t}
                kills={kills}
                plant={plant}
                defused={defused}
                selfTeam={selfTeam}
                selfPuuid={replay.selfPuuid}
                agentOf={(puuid) => byPuuid.get(puuid)?.characterId}
                labelOf={(puuid) => player(puuid).label}
                lookup={lookup}
                showCallouts={state.showCallouts}
                showCalibration={state.showCalibration}
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
              <PositionStatus snapshotT={snapshot?.t} source={snapshot?.source} t={t} />
              <div className="pointer-events-auto flex items-center gap-1.5">
                <ViewSwitch view={state.view} onView={state.setView} />
                <Toggle on={state.showCallouts} onClick={state.toggleCallouts}>
                  Callouts
                </Toggle>
                {state.view === "2d" && (
                  <Toggle on={state.showCalibration} onClick={state.toggleCalibration}>
                    Grid
                  </Toggle>
                )}
              </div>
            </div>
            {state.view === "3d" && map && (
              <div className="pointer-events-none absolute bottom-0 right-0 z-20 p-3">
                <CameraPanel
                  view={state.view}
                  cameraMode={state.cameraMode}
                  pov={state.pov}
                  snapshot={snapshot}
                  kills={kills}
                  plantKnown={Boolean(plant?.pos)}
                  labelOf={(puuid) => player(puuid).label}
                  onView={state.setView}
                  onCameraMode={state.setCameraMode}
                  onPov={state.setPov}
                />
              </div>
            )}
            {state.view === "3d" && map && (
              <div className="pointer-events-none absolute bottom-0 left-0 z-20 max-w-[45%] p-3 text-[11px] leading-snug text-muted">
                Low-poly blockout generated from the minimap outline and callout heights. Walls and
                floor heights are approximate.
              </div>
            )}
          </div>

          <Scrubber
            events={round.events}
            end={end}
            t={t}
            plantWindow={plantWindow(round, end)}
            playing={playing}
            speed={speed}
            onSeek={(next) => {
              setPlaying(false);
              setTime(next);
            }}
            onTogglePlay={() => {
              if (!playing && t >= end) setTime(0);
              setPlaying(!playing);
            }}
            onCycleSpeed={state.cycleSpeed}
            teamOf={(puuid) => byPuuid.get(puuid)?.team}
            selfTeam={selfTeam}
            describe={describe}
          />
        </div>

        <div className="space-y-4">
          <div
            className={`flex items-center gap-4 rounded-2xl border p-4 ${
              won
                ? "border-ally/30 bg-gradient-to-br from-ally-dim/70 to-panel"
                : "border-enemy/30 bg-gradient-to-br from-enemy-dim/70 to-panel"
            }`}
          >
            <div
              className={`grid h-12 w-12 place-items-center rounded-xl ${won ? "bg-ally text-ink" : "bg-enemy text-ink"}`}
            >
              <ResultIcon result={round.resultType} size={24} strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Round {round.roundNum + 1}
              </div>
              <div
                className={`font-display text-2xl font-bold uppercase ${won ? "text-ally" : "text-enemy"}`}
              >
                {won ? "Won" : "Lost"}
              </div>
              <div className="text-sm text-soft">{resultText(round.resultType)}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-panel">
            <Tabs panel={state.panel} onChange={state.setPanel} />
            <div className="max-h-[calc(100vh-22rem)] min-h-64 overflow-y-auto p-3">
              {state.panel === "feed" && (
                <KillFeed
                  events={round.events}
                  t={t}
                  player={player}
                  weaponIcon={(id) => lookup.weapon(id)}
                  onSeek={(next) => {
                    setPlaying(false);
                    setTime(next);
                  }}
                />
              )}
              {state.panel === "economy" && (
                <EconomyPanel
                  economy={round.economy}
                  players={replay.players}
                  selfTeam={selfTeam}
                  player={player}
                  lookup={lookup}
                  afk={round.afk}
                />
              )}
              {state.panel === "scoreboard" && (
                <Scoreboard players={replay.players} selfTeam={selfTeam} player={player} />
              )}
            </div>
          </div>
          <p className="px-1 text-xs text-muted">
            Shortcuts: <Kbd>Space</Kbd> play · <Kbd>←</Kbd>
            <Kbd>→</Kbd> events · <Kbd>[</Kbd>
            <Kbd>]</Kbd> rounds
          </p>
        </div>
      </div>
    </div>
  );
}

function MatchHeader({
  replay,
  player,
}: {
  replay: MatchReplay;
  player: (p: string) => PlayerInfo;
}) {
  const selfTeam = selfTeamOf(replay);
  const won = replay.rounds.filter((r) => r.winningTeam === selfTeam).length;
  const lost = replay.rounds.length - won;
  const self = replay.players.find((p) => p.isSelf);
  const me = self ? player(self.puuid) : undefined;
  const thumb = useReview((s) => s.lookup.map(replay.mapId)?.thumbnail);
  const victory = won > lost;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-panel">
      {thumb && (
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-panel/40" />
      <div className="relative flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {new Date(replay.gameStartMillis).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-wide">
            {mapDisplayName(replay.mapId)}
          </h2>
        </div>
        <div className="flex items-center gap-3 font-display">
          <span className="text-4xl font-bold tabular text-ally">{won}</span>
          <span className="text-2xl text-muted">:</span>
          <span className="text-4xl font-bold tabular text-enemy">{lost}</span>
          <span
            className={`ml-2 rounded-md px-2 py-0.5 text-sm font-bold uppercase tracking-wider ${
              victory ? "bg-ally text-ink" : "bg-enemy text-ink"
            }`}
          >
            {victory ? "Victory" : "Defeat"}
          </span>
        </div>
        {self && me && (
          <div className="ml-auto flex items-center gap-3">
            {me.agentIcon && (
              <img
                src={me.agentIcon}
                alt={me.agentName ?? ""}
                className="h-12 w-12 rounded-xl border-2 border-white/70 bg-raised"
              />
            )}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                You{me.agentName ? ` · ${me.agentName}` : ""}
              </div>
              {self.stats && (
                <div className="font-display text-xl font-bold tabular">
                  {self.stats.kills} / {self.stats.deaths} / {self.stats.assists}
                  <span className="ml-2 text-xs font-medium uppercase tracking-wider text-muted">
                    K / D / A
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Says exactly which moment the dots come from, so nothing reads as a live trace. */
function PositionStatus({
  snapshotT,
  source,
  t,
}: {
  snapshotT?: number;
  source?: string;
  t: number;
}) {
  const base =
    "pointer-events-auto max-w-[70%] rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md";
  if (snapshotT === undefined) {
    return (
      <div className={`${base} border-line bg-ink/80 text-soft`}>
        No known positions yet: the API only records them at kills, plants, and defuses.
      </div>
    );
  }
  if (snapshotT < t) {
    return (
      <div className={`${base} border-spike/40 bg-ink/80 text-spike`}>
        Last known positions · {formatRoundTime(snapshotT)} {source} · now unknown
      </div>
    );
  }
  return (
    <div className={`${base} border-ally/40 bg-ink/80 text-ally`}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ally align-middle" />
      Known positions · {formatRoundTime(snapshotT)} {source}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition ${
        on
          ? "border-white/40 bg-white/15 text-white"
          : "border-line bg-ink/70 text-muted hover:text-soft"
      }`}
    >
      {children}
    </button>
  );
}

const TABS: { id: SidePanel; label: string }[] = [
  { id: "feed", label: "Kill feed" },
  { id: "economy", label: "Economy" },
  { id: "scoreboard", label: "Scoreboard" },
];

function Tabs({ panel, onChange }: { panel: SidePanel; onChange: (p: SidePanel) => void }) {
  return (
    <div
      className="flex gap-1 border-b border-line p-1.5"
      role="tablist"
      aria-label="Round details"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={panel === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            panel === tab.id ? "bg-raised text-white" : "text-muted hover:text-soft"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="mx-0.5 rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] text-soft">
      {children}
    </kbd>
  );
}

function resultText(result: string): string {
  switch (result) {
    case "Bomb detonated":
      return "Spike detonated";
    case "Bomb defused":
      return "Spike defused";
    case "Round timer expired":
      return "Time ran out";
    case "Eliminated":
      return "Team eliminated";
    default:
      return result;
  }
}

/** Advances the playhead while playing. Positions still only change at known snapshots. */
function usePlayback(end: number) {
  const playing = useReview((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const { t, speed, setTime, setPlaying } = useReview.getState();
      const next = t + (now - last) * speed;
      last = now;
      if (next >= end) {
        setTime(end);
        setPlaying(false);
        return;
      }
      setTime(next);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, end]);
}

function useShortcuts(round: RoundReplay | undefined, roundCount: number) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      const s = useReview.getState();
      if (ev.key === " ") {
        ev.preventDefault();
        s.setPlaying(!s.playing);
      } else if (ev.key === "ArrowRight" && round) {
        const next = round.events.find((e) => e.t > s.t);
        if (next) {
          s.setPlaying(false);
          s.setTime(next.t);
        }
      } else if (ev.key === "ArrowLeft" && round) {
        const prev = [...round.events].reverse().find((e) => e.t < s.t);
        s.setPlaying(false);
        s.setTime(prev?.t ?? 0);
      } else if (ev.key === "]" && s.roundIndex < roundCount - 1) {
        s.selectRound(s.roundIndex + 1);
      } else if (ev.key === "[" && s.roundIndex > 0) {
        s.selectRound(s.roundIndex - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [round, roundCount]);
}
