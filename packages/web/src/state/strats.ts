import { create } from "zustand";
import type { Strat, StratFrame, StratShape, StratSummary, StratToken } from "@replay-lab/shared";
import { deleteStrat, errorMessage, fetchStrat, fetchStrats, saveStrat } from "../api/client.js";

export type Tool =
  | "select"
  | "pen"
  | "arrow"
  | "text"
  | "agent"
  | "smoke"
  | "flash"
  | "molly"
  | "recon"
  | "wall"
  | "erase";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

type Load<T> =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

type StratsState = {
  list: Load<StratSummary[]>;
  current: Strat | undefined;
  frameIndex: number;
  tool: Tool;
  color: string;
  /** Agent and side used by the "agent" tool. */
  placing: { agentId: string | undefined; side: "ally" | "enemy" };
  selected: string | undefined;
  past: Strat[];
  future: Strat[];
  saveStatus: SaveStatus;
  saveError: string | undefined;

  loadList: () => Promise<void>;
  open: (id: string) => Promise<void>;
  create: (mapPath: string, side: Strat["side"], title: string) => void;
  remove: (id: string) => Promise<void>;
  close: () => void;

  /** Applies a change to the current strat, recording it for undo. */
  edit: (change: (s: Strat) => Strat) => void;
  editFrame: (change: (f: StratFrame) => StratFrame) => void;
  addShape: (shape: StratShape) => void;
  addToken: (token: StratToken) => void;
  removeItem: (id: string) => void;
  undo: () => void;
  redo: () => void;

  setFrame: (index: number) => void;
  addFrame: () => void;
  deleteFrame: (index: number) => void;

  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setPlacing: (p: Partial<StratsState["placing"]>) => void;
  select: (id: string | undefined) => void;
};

export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

let saveTimer: ReturnType<typeof setTimeout> | undefined;
const HISTORY = 100;

export const useStrats = create<StratsState>((set, get) => {
  /** Debounced autosave of the current strat. */
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    set({ saveStatus: "unsaved" });
    saveTimer = setTimeout(async () => {
      const strat = get().current;
      if (!strat) return;
      set({ saveStatus: "saving" });
      try {
        await saveStrat(strat);
        // Only mark saved if nothing changed while the request was in flight.
        if (get().current === strat) set({ saveStatus: "saved", saveError: undefined });
        void get().loadList();
      } catch (err) {
        set({ saveStatus: "error", saveError: errorMessage(err) });
      }
    }, 700);
  };

  const commit = (next: Strat) => {
    const prev = get().current;
    if (!prev) return;
    set({
      current: { ...next, updatedAt: Date.now() },
      past: [...get().past, prev].slice(-HISTORY),
      future: [],
    });
    scheduleSave();
  };

  return {
    list: { status: "idle" },
    current: undefined,
    frameIndex: 0,
    tool: "select",
    color: "#ff4655",
    placing: { agentId: undefined, side: "ally" },
    selected: undefined,
    past: [],
    future: [],
    saveStatus: "saved",
    saveError: undefined,

    loadList: async () => {
      if (get().list.status !== "ready") set({ list: { status: "loading" } });
      try {
        set({ list: { status: "ready", data: await fetchStrats() } });
      } catch (err) {
        set({ list: { status: "error", message: errorMessage(err) } });
      }
    },

    open: async (id) => {
      try {
        const strat = await fetchStrat(id);
        set({
          current: strat,
          frameIndex: 0,
          past: [],
          future: [],
          selected: undefined,
          saveStatus: "saved",
        });
      } catch (err) {
        set({ saveStatus: "error", saveError: errorMessage(err) });
      }
    },

    create: (mapPath, side, title) => {
      const strat: Strat = {
        id: newId(),
        title,
        mapPath,
        side,
        notes: "",
        updatedAt: Date.now(),
        frames: [{ id: newId(), name: "Setup", tokens: [], shapes: [] }],
      };
      set({
        current: strat,
        frameIndex: 0,
        past: [],
        future: [],
        selected: undefined,
        tool: "agent",
      });
      scheduleSave();
    },

    remove: async (id) => {
      try {
        await deleteStrat(id);
        if (get().current?.id === id) set({ current: undefined });
        await get().loadList();
      } catch (err) {
        set({ saveStatus: "error", saveError: errorMessage(err) });
      }
    },

    close: () => set({ current: undefined, selected: undefined }),

    edit: (change) => {
      const cur = get().current;
      if (cur) commit(change(cur));
    },

    editFrame: (change) => {
      const { current: cur, frameIndex } = get();
      if (!cur) return;
      commit({ ...cur, frames: cur.frames.map((f, i) => (i === frameIndex ? change(f) : f)) });
    },

    addShape: (shape) => get().editFrame((f) => ({ ...f, shapes: [...f.shapes, shape] })),
    addToken: (token) =>
      get().editFrame((f) => (f.tokens.length >= 20 ? f : { ...f, tokens: [...f.tokens, token] })),
    removeItem: (id) => {
      get().editFrame((f) => ({
        ...f,
        tokens: f.tokens.filter((t) => t.id !== id),
        shapes: f.shapes.filter((s) => s.id !== id),
      }));
      if (get().selected === id) set({ selected: undefined });
    },

    undo: () => {
      const { past, current: cur, future } = get();
      const prev = past.at(-1);
      if (!prev || !cur) return;
      set({
        current: prev,
        past: past.slice(0, -1),
        future: [cur, ...future],
        frameIndex: Math.min(get().frameIndex, prev.frames.length - 1),
      });
      scheduleSave();
    },
    redo: () => {
      const { past, current: cur, future } = get();
      const next = future[0];
      if (!next || !cur) return;
      set({ current: next, past: [...past, cur], future: future.slice(1) });
      scheduleSave();
    },

    setFrame: (index) => set({ frameIndex: index, selected: undefined }),
    addFrame: () => {
      const { current: cur, frameIndex } = get();
      if (!cur || cur.frames.length >= 12) return;
      const from = cur.frames[frameIndex];
      // A new step starts from the previous step's player positions.
      const frame: StratFrame = {
        id: newId(),
        name: `Step ${cur.frames.length + 1}`,
        tokens: (from?.tokens ?? []).map((t) => ({ ...t, id: newId() })),
        shapes: [],
      };
      commit({ ...cur, frames: [...cur.frames, frame] });
      set({ frameIndex: cur.frames.length });
    },
    deleteFrame: (index) => {
      const cur = get().current;
      if (!cur || cur.frames.length <= 1) return;
      commit({ ...cur, frames: cur.frames.filter((_, i) => i !== index) });
      set({ frameIndex: Math.max(0, Math.min(get().frameIndex, cur.frames.length - 2)) });
    },

    setTool: (tool) => set({ tool, selected: undefined }),
    setColor: (color) => set({ color }),
    setPlacing: (p) => set((s) => ({ placing: { ...s.placing, ...p }, tool: "agent" })),
    select: (id) => set({ selected: id }),
  };
});
