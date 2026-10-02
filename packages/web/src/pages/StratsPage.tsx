import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MAP_DATA, mapDisplayName, type Strat } from "@replay-lab/shared";
import {
  AgentIcon,
  ArrowIcon,
  CursorIcon,
  EraserIcon,
  FlashIcon,
  MollyIcon,
  PenIcon,
  PlusIcon,
  ReconIcon,
  RedoIcon,
  SmokeIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
  WallIcon,
} from "../components/Icons.js";
import { Notice, SectionLabel, Skeleton } from "../components/Notice.js";
import { StratBoard } from "../components/strats/StratBoard.js";
import { mapConfigFor } from "../maps/index.js";
import { useReview } from "../state/store.js";
import { useStrats, type Tool } from "../state/strats.js";

export function StratsPage() {
  const { list, current, loadList } = useStrats();

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return (
    <div className="mx-auto grid max-w-[1680px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
        <SectionLabel
          right={list.status === "ready" ? String(list.data.length).padStart(2, "0") : undefined}
        >
          Your strats
        </SectionLabel>
        <StratList />
      </aside>
      <section className="min-w-0">{current ? <Editor strat={current} /> : <NewStrat />}</section>
    </div>
  );
}

function StratList() {
  const { list, current, open, remove, close } = useStrats();
  const lookup = useReview((s) => s.lookup);
  const [confirming, setConfirming] = useState<string>();
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={close}
        className="cut flex w-full items-center gap-2 bg-red px-3 py-2.5 font-cond text-sm font-bold uppercase tracking-[0.18em] text-bone hover:brightness-110"
      >
        <PlusIcon size={16} /> New strat
      </button>
      {list.status === "loading" && <Skeleton className="h-14" />}
      {list.status === "error" && <Notice tone="error">{list.message}</Notice>}
      {list.status === "ready" && list.data.length === 0 && (
        <p className="pt-2 text-sm text-muted">No strats yet. Pick a map to start one.</p>
      )}
      {list.status === "ready" &&
        list.data.map((s) => {
          const thumb = lookup.map(s.mapPath)?.thumbnail;
          const active = current?.id === s.id;
          return (
            <div
              key={s.id}
              className={`group relative flex h-14 items-stretch overflow-hidden ${active ? "bg-raised" : "bg-panel"}`}
            >
              {thumb && (
                <img
                  src={thumb}
                  alt=""
                  className="absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-25"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-panel via-panel/90 to-transparent" />
              <div
                className={`relative w-1.5 shrink-0 ${s.side === "attack" ? "bg-red" : "bg-ally"}`}
              />
              <button
                type="button"
                onClick={() => void open(s.id)}
                className="relative min-w-0 flex-1 px-3 text-left"
              >
                <div className="truncate font-display text-xl leading-none tracking-wide text-bone">
                  {s.title}
                </div>
                <div className="mt-1 font-cond text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">
                  {mapDisplayName(s.mapPath)} · {s.side}
                </div>
              </button>
              {confirming === s.id ? (
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  onBlur={() => setConfirming(undefined)}
                  autoFocus
                  className="relative bg-red px-3 font-cond text-xs font-bold uppercase tracking-[0.15em] text-bone"
                >
                  Delete?
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete ${s.title}`}
                  title="Delete"
                  onClick={() => setConfirming(s.id)}
                  className="relative px-3 text-muted opacity-0 transition hover:text-red focus:opacity-100 group-hover:opacity-100"
                >
                  <TrashIcon size={16} />
                </button>
              )}
            </div>
          );
        })}
    </div>
  );
}

/** Map + side picker for a new strat. */
function NewStrat() {
  const create = useStrats((s) => s.create);
  const lookup = useReview((s) => s.lookup);
  const [side, setSide] = useState<Strat["side"]>("attack");
  const [title, setTitle] = useState("");

  return (
    <div className="space-y-5">
      <div className="border border-line bg-panel p-5">
        <div className="hud-label">Strategy board</div>
        <h2 className="mt-1 font-display text-5xl leading-none tracking-wide text-bone">
          New strat
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-soft">
          Pick a map and a side. Then place agents, draw routes, drop utility, and write notes. Add
          steps to show how the round plays out. Everything saves automatically and is visible only
          to you.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="hud-label">Name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. A split, fast"
              className="mt-1 block w-72 border border-line bg-surface px-3 py-2 font-cond text-base font-semibold uppercase tracking-wide text-bone outline-none placeholder:text-muted focus:border-bone"
            />
          </label>
          <div>
            <span className="hud-label">Side</span>
            <div className="mt-1 flex border border-line">
              {(["attack", "defense"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={side === s}
                  onClick={() => setSide(s)}
                  className={`px-4 py-2 font-cond text-sm font-bold uppercase tracking-[0.18em] ${
                    side === s
                      ? s === "attack"
                        ? "bg-red text-bone"
                        : "bg-ally text-ink"
                      : "text-muted hover:text-bone"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Choose a map</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {MAP_DATA.map((m) => {
            const thumb = lookup.map(m.mapPath)?.thumbnail;
            return (
              <button
                key={m.mapPath}
                type="button"
                onClick={() => create(m.mapPath, side, title.trim() || `${m.displayName} ${side}`)}
                className="cut group relative h-28 overflow-hidden border border-line bg-panel text-left"
              >
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-50 transition group-hover:scale-105 group-hover:opacity-80"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                <span className="absolute bottom-2 left-3 font-display text-3xl leading-none tracking-wide text-bone">
                  {m.displayName}
                </span>
                <span className="absolute bottom-0 left-0 h-[3px] w-0 bg-red transition-all group-hover:w-full" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TOOLS: { id: Tool; label: string; icon: (p: { size: number }) => ReactNode; key: string }[] =
  [
    { id: "select", label: "Select / move", icon: CursorIcon, key: "V" },
    { id: "agent", label: "Place agent", icon: AgentIcon, key: "A" },
    { id: "pen", label: "Draw", icon: PenIcon, key: "D" },
    { id: "arrow", label: "Route arrow", icon: ArrowIcon, key: "R" },
    { id: "text", label: "Text", icon: TextIcon, key: "T" },
    { id: "smoke", label: "Smoke", icon: SmokeIcon, key: "1" },
    { id: "flash", label: "Flash", icon: FlashIcon, key: "2" },
    { id: "molly", label: "Molly", icon: MollyIcon, key: "3" },
    { id: "recon", label: "Recon", icon: ReconIcon, key: "4" },
    { id: "wall", label: "Wall", icon: WallIcon, key: "5" },
    { id: "erase", label: "Erase", icon: EraserIcon, key: "E" },
  ];

const COLORS = ["#ff4655", "#45e0bd", "#f5c542", "#ece8e1", "#4fd1ff", "#b78cff"];

function Editor({ strat }: { strat: Strat }) {
  const s = useStrats();
  const lookup = useReview((st) => st.lookup);
  const content = useReview((st) => st.content);
  const map = mapConfigFor(strat.mapPath);
  const frame = strat.frames[s.frameIndex] ?? strat.frames[0];
  const [showCallouts, setShowCallouts] = useState(true);
  const agents = useMemo(
    () => [...(content?.agents ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [content],
  );

  useEditorShortcuts();

  if (!map || !frame) return <Notice tone="error">This map isn't supported yet.</Notice>;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-end gap-4 border border-line bg-panel px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="hud-label">
              {mapDisplayName(strat.mapPath)} ·{" "}
              <span className={strat.side === "attack" ? "text-red" : "text-ally"}>
                {strat.side}
              </span>
            </div>
            <input
              value={strat.title}
              onChange={(e) =>
                s.edit((x) => ({ ...x, title: e.target.value.slice(0, 80) || "Untitled" }))
              }
              aria-label="Strat name"
              className="mt-0.5 w-full bg-transparent font-display text-4xl leading-none tracking-wide text-bone outline-none"
            />
          </div>
          <SaveBadge />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border border-line bg-panel p-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              title={`${t.label} (${t.key})`}
              aria-label={t.label}
              aria-pressed={s.tool === t.id}
              onClick={() => s.setTool(t.id)}
              className={`grid h-9 w-9 place-items-center transition ${
                s.tool === t.id ? "bg-bone text-ink" : "text-soft hover:bg-raised hover:text-bone"
              }`}
            >
              {t.icon({ size: 17 })}
            </button>
          ))}
          <span className="mx-1.5 h-6 w-px bg-line" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={s.color === c}
              onClick={() => s.setColor(c)}
              className={`h-6 w-6 border-2 ${s.color === c ? "border-bone" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
          <span className="mx-1.5 h-6 w-px bg-line" />
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!s.past.length}
            onClick={s.undo}
            className="grid h-9 w-9 place-items-center text-soft hover:text-bone disabled:opacity-25"
          >
            <UndoIcon size={17} />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!s.future.length}
            onClick={s.redo}
            className="grid h-9 w-9 place-items-center text-soft hover:text-bone disabled:opacity-25"
          >
            <RedoIcon size={17} />
          </button>
          <button
            type="button"
            onClick={() => s.editFrame((f) => ({ ...f, shapes: [], tokens: [] }))}
            className="ml-auto px-2 font-cond text-xs font-bold uppercase tracking-[0.18em] text-muted hover:text-red"
          >
            Clear step
          </button>
        </div>

        {/* Board */}
        <div className="hud-frame mx-auto aspect-square w-full max-w-[min(100%,calc(100vh-17rem))] border border-line bg-surface">
          <div className="absolute inset-0 overflow-hidden">
            <StratBoard
              map={map}
              minimapUrl={lookup.map(strat.mapPath)?.minimap}
              frame={frame}
              lookup={lookup}
              showCallouts={showCallouts}
            />
          </div>
          <div className="pointer-events-none absolute right-0 top-0 z-20 p-3">
            <button
              type="button"
              aria-pressed={showCallouts}
              onClick={() => setShowCallouts((v) => !v)}
              className={`pointer-events-auto border bg-ink/90 px-3 py-1 font-cond text-xs font-bold uppercase tracking-[0.18em] ${
                showCallouts ? "border-bone text-bone" : "border-line text-muted"
              }`}
            >
              Callouts
            </button>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className="space-y-4">
        <Panel title="Steps" right={`${strat.frames.length}/12`}>
          <div className="space-y-1">
            {strat.frames.map((f, i) => (
              <div
                key={f.id}
                className={`flex items-center gap-2 px-2 py-1.5 ${i === s.frameIndex ? "bg-raised" : "hover:bg-raised/50"}`}
              >
                <button
                  type="button"
                  onClick={() => s.setFrame(i)}
                  className="font-display text-xl leading-none text-muted"
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
                {i === s.frameIndex ? (
                  <input
                    value={f.name}
                    onChange={(e) =>
                      s.edit((x) => ({
                        ...x,
                        frames: x.frames.map((ff, j) =>
                          j === i ? { ...ff, name: e.target.value.slice(0, 40) || "Step" } : ff,
                        ),
                      }))
                    }
                    aria-label="Step name"
                    className="min-w-0 flex-1 bg-transparent font-cond text-sm font-bold uppercase tracking-wide text-bone outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => s.setFrame(i)}
                    className="min-w-0 flex-1 truncate text-left font-cond text-sm font-bold uppercase tracking-wide text-soft"
                  >
                    {f.name}
                  </button>
                )}
                {strat.frames.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Delete ${f.name}`}
                    onClick={() => s.deleteFrame(i)}
                    className="text-muted hover:text-red"
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={s.addFrame}
              disabled={strat.frames.length >= 12}
              className="mt-1 flex w-full items-center justify-center gap-1.5 border border-dashed border-line py-1.5 font-cond text-xs font-bold uppercase tracking-[0.18em] text-muted hover:border-soft hover:text-bone disabled:opacity-30"
            >
              <PlusIcon size={14} /> Add step (keeps agent positions)
            </button>
          </div>
        </Panel>

        <Panel title="Agents">
          <div className="mb-2 grid grid-cols-2 border border-line">
            {(["ally", "enemy"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={s.placing.side === side}
                onClick={() => s.setPlacing({ side })}
                className={`py-1.5 font-cond text-xs font-bold uppercase tracking-[0.18em] ${
                  s.placing.side === side
                    ? side === "ally"
                      ? "bg-ally text-ink"
                      : "bg-red text-bone"
                    : "text-muted hover:text-bone"
                }`}
              >
                {side === "ally" ? "Your team" : "Enemy"}
              </button>
            ))}
          </div>
          {agents.length === 0 ? (
            <p className="text-xs text-muted">
              Agent icons need the content service; plain markers are used offline.
            </p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {agents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.name}
                  aria-label={`Place ${a.name}`}
                  aria-pressed={s.tool === "agent" && s.placing.agentId === a.id}
                  onClick={() => s.setPlacing({ agentId: a.id })}
                  className={`aspect-square overflow-hidden border-2 bg-ink ${
                    s.tool === "agent" && s.placing.agentId === a.id
                      ? s.placing.side === "ally"
                        ? "border-ally"
                        : "border-red"
                      : "border-transparent hover:border-line"
                  }`}
                >
                  {a.icon && <img src={a.icon} alt="" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted">
            Pick an agent, then click the map. Use Select to move, Erase to remove.
          </p>
        </Panel>

        <Panel title="Notes">
          <textarea
            value={strat.notes}
            onChange={(e) => s.edit((x) => ({ ...x, notes: e.target.value.slice(0, 10_000) }))}
            rows={8}
            placeholder={
              "Roles, timings, fallbacks…\ne.g. Sova drone A main at 1:20, Jett dash in after flash"
            }
            className="w-full resize-y border border-line bg-surface p-2.5 text-sm leading-relaxed text-bone outline-none placeholder:text-muted focus:border-soft"
          />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, right, children }: { title: string; right?: string; children: ReactNode }) {
  return (
    <div className="border border-line bg-panel p-3">
      <SectionLabel right={right}>{title}</SectionLabel>
      {children}
    </div>
  );
}

function SaveBadge() {
  const { saveStatus, saveError } = useStrats();
  const label = { saved: "Saved", unsaved: "Unsaved", saving: "Saving…", error: "Not saved" }[
    saveStatus
  ];
  const tone =
    saveStatus === "error"
      ? "border-red text-red"
      : saveStatus === "saved"
        ? "border-ally/50 text-ally"
        : "border-line text-soft";
  return (
    <span
      title={saveError}
      className={`border px-3 py-1 font-cond text-xs font-bold uppercase tracking-[0.18em] ${tone}`}
    >
      {label}
    </span>
  );
}

function useEditorShortcuts() {
  useEffect(() => {
    const keys: Record<string, Tool> = Object.fromEntries(
      TOOLS.map((t) => [t.key.toLowerCase(), t.id]),
    );
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const s = useStrats.getState();
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) s.redo();
        else s.undo();
      } else if (mod && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        s.redo();
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && s.selected) {
        ev.preventDefault();
        s.removeItem(s.selected);
      } else if (ev.key === "Escape") {
        s.select(undefined);
      } else if (!mod && keys[ev.key.toLowerCase()]) {
        s.setTool(keys[ev.key.toLowerCase()] as Tool);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
