import { useCallback, useEffect, useMemo } from "react";
import type { MatchReplay, RoundEvent, RoundReplay } from "@replay-lab/shared";
import { mapDisplayName } from "@replay-lab/shared";
import { CameraPanel, ViewSwitch } from "../components/CameraPanel.js";
import { EconomyPanel } from "../components/EconomyPanel.js";
import { ResultIcon } from "../components/Icons.js";
import { KillFeed } from "../components/KillFeed.js";
import { MapView } from "../components/MapView.js";
import { MatchList } from "../components/MatchList.js";
import { Notice, SectionLabel, Skeleton } from "../components/Notice.js";
import type { PlayerInfo } from "../components/playerInfo.js";
import { RoundStrip } from "../components/RoundStrip.js";
import { Scoreboard } from "../components/Scoreboard.js";
import { Scrubber } from "../components/Scrubber.js";
import { mapConfigFor } from "../maps/index.js";
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
import { Map3D } from "../three/Map3D.js";

export function ReviewPage() {
  const { matches, replay, selectedMatchId, lookup, selectMatch, loadMatches } = useReview();

  return (
    <div className="mx-auto grid max-w-[1680px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
        <SectionLabel
          right={
            matches.status === "ready" ? String(matches.data.length).padStart(2, "0") : undefined
          }
        >
          Match history
        </SectionLabel>
        {(matches.status === "loading" || matches.status === "idle") && (
          <div className="space-y-1.5">
            <Skeleton className="h-[68px]" />
            <Skeleton className="h-[68px]" />
            <Skeleton className="h-[68px]" />
          </div>
        )}
        {matches.status === "error" && (
          <Notice tone="error" title="Couldn't load matches">
            <p>{matches.message}</p>
            <button
              type="button"
              onClick={() => void loadMatches()}
              className="mt-3 border border-red px-3 py-1 font-cond text-xs font-bold uppercase tracking-[0.18em] text-red hover:bg-red hover:text-ink"
            >
              Retry
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
            <Skeleton className="h-32" />
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
  const seek = (next: number) => {
    setPlaying(false);
    setTime(next);
  };

  return (
    <div className="space-y-5">
      <MatchHeader replay={replay} player={player} />

      <div>
        <SectionLabel right={`${replay.rounds.length} rounds`}>Rounds</SectionLabel>
        <RoundStrip
          rounds={replay.rounds}
          selected={roundIndex}
          selfTeam={selfTeam}
          onSelect={selectRound}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          <div
            className={`hud-frame mx-auto w-full border border-line bg-surface ${
              state.view === "3d"
                ? "aspect-[16/10] max-h-[calc(100vh-22rem)] min-h-[420px]"
                : "aspect-square max-w-[min(100%,max(440px,calc(100vh-29rem)))]"
            }`}
          >
            <div className="absolute inset-0 overflow-hidden">
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
            </div>
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
              <>
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
                <div className="pointer-events-none absolute bottom-0 left-0 z-20 max-w-[45%] p-3 font-cond text-[11px] font-semibold uppercase leading-snug tracking-[0.12em] text-muted">
                  Blockout generated from minimap + callout heights · approximate
                </div>
              </>
            )}
          </div>

          <Scrubber
            events={round.events}
            end={end}
            t={t}
            plantWindow={plantWindow(round, end)}
            playing={playing}
            speed={speed}
            onSeek={seek}
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
          <RoundResult round={round} won={won} />

          <div className="border border-line bg-panel">
            <Tabs panel={state.panel} onChange={state.setPanel} />
            <div className="max-h-[calc(100vh-24rem)] min-h-64 overflow-y-auto p-3">
              {state.panel === "feed" && (
                <KillFeed
                  events={round.events}
                  t={t}
                  player={player}
                  weaponIcon={(id) => lookup.weapon(id)}
                  onSeek={seek}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-cond text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
            <span>
              <Kbd>Space</Kbd> Play
            </span>
            <span>
              <Kbd>←</Kbd>
              <Kbd>→</Kbd> Events
            </span>
            <span>
              <Kbd>[</Kbd>
              <Kbd>]</Kbd> Rounds
            </span>
          </div>
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
  const lookup = useReview((s) => s.lookup);
  const thumb = lookup.map(replay.mapId)?.thumbnail;
  const portrait = lookup.agent(self?.characterId)?.portrait;
  const victory = won > lost;

  return (
    <div className="relative h-28 overflow-hidden border border-line bg-panel">
      {thumb && (
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/20" />
      <div className={`absolute inset-y-0 left-0 w-1.5 ${victory ? "bg-ally" : "bg-red"}`} />
      {portrait && (
        <img
          src={portrait}
          alt=""
          className="pointer-events-none absolute -bottom-20 right-4 h-[260px] object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.6)]"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="relative flex h-full items-center gap-10 pl-8 pr-56">
        <div>
          <div className="hud-label">
            {new Date(replay.gameStartMillis).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
          <h2 className="mt-1 font-display text-[52px] leading-none tracking-wide text-bone">
            {mapDisplayName(replay.mapId)}
          </h2>
        </div>
        <div className="border-l border-line pl-8">
          <div
            className={`font-cond text-sm font-bold uppercase tracking-[0.3em] ${victory ? "text-ally" : "text-red"}`}
          >
            {victory ? "Victory" : "Defeat"}
          </div>
          <div className="font-display text-[52px] leading-none tabular">
            <span className="text-ally">{won}</span>
            <span className="mx-2 text-muted">–</span>
            <span className="text-red">{lost}</span>
          </div>
        </div>
        {self?.stats && (
          <div className="hidden border-l border-line pl-8 md:block">
            <div className="hud-label">{me?.agentName ? `You · ${me.agentName}` : "You"}</div>
            <div className="mt-1 flex gap-6 font-display text-4xl leading-none tabular text-bone">
              <Stat label="K" value={self.stats.kills} />
              <Stat label="D" value={self.stats.deaths} />
              <Stat label="A" value={self.stats.assists} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      {value}
      <span className="font-cond text-xs font-bold tracking-[0.2em] text-muted">{label}</span>
    </span>
  );
}

function RoundResult({ round, won }: { round: RoundReplay; won: boolean }) {
  return (
    <div
      className={`cut relative flex items-center gap-4 overflow-hidden p-4 ${won ? "bg-ally-dim" : "bg-enemy-dim"}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${won ? "bg-ally" : "bg-red"}`} />
      <div
        className={`grid h-14 w-14 shrink-0 place-items-center ${won ? "bg-ally text-ink" : "bg-red text-ink"}`}
      >
        <ResultIcon result={round.resultType} size={28} strokeWidth={2.2} />
      </div>
      <div>
        <div className="hud-label">Round {String(round.roundNum + 1).padStart(2, "0")}</div>
        <div
          className={`font-display text-4xl leading-none tracking-wide ${won ? "text-ally" : "text-red"}`}
        >
          {won ? "Round won" : "Round lost"}
        </div>
        <div className="mt-0.5 font-cond text-sm font-semibold uppercase tracking-[0.15em] text-soft">
          {resultText(round.resultType)}
        </div>
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
    "pointer-events-auto flex max-w-[65%] items-center gap-2 border bg-ink/90 px-3 py-1.5 font-cond text-xs font-bold uppercase tracking-[0.14em]";
  if (snapshotT === undefined) {
    return (
      <div className={`${base} border-line text-soft`}>
        <span className="h-2 w-2 shrink-0 border border-soft" />
        No positions yet · kill/plant/defuse only
      </div>
    );
  }
  if (snapshotT < t) {
    return (
      <div className={`${base} border-spike/60 text-spike`}>
        <span className="h-2 w-2 shrink-0 bg-spike/40 outline outline-1 outline-spike" />
        Last known · {formatRoundTime(snapshotT)} {source} · now unknown
      </div>
    );
  }
  return (
    <div className={`${base} border-ally/60 text-ally`}>
      <span className="h-2 w-2 shrink-0 bg-ally" />
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
      className={`border px-3 py-1 font-cond text-xs font-bold uppercase tracking-[0.18em] transition ${
        on ? "border-bone bg-ink/90 text-bone" : "border-line bg-ink/90 text-muted hover:text-bone"
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
    <div className="flex border-b border-line" role="tablist" aria-label="Round details">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={panel === tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative flex-1 px-3 py-3 font-cond text-sm font-bold uppercase tracking-[0.18em] transition ${
            panel === tab.id ? "text-bone" : "text-muted hover:text-soft"
          }`}
        >
          {tab.label}
          {panel === tab.id && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-red" />}
        </button>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="mr-0.5 inline-block min-w-5 border border-line bg-surface px-1 py-px text-center font-cond text-[10px] text-bone">
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
      return "Time expired";
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
      if (
        ev.target instanceof HTMLInputElement ||
        ev.target instanceof HTMLTextAreaElement ||
        ev.target instanceof HTMLSelectElement
      )
        return;
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
