import { create } from "zustand";
import type { Content, MatchReplay, MatchSummary, SessionInfo } from "@replay-lab/shared";
import {
  errorMessage,
  fetchContent,
  fetchMatches,
  fetchReplay,
  fetchSession,
} from "../api/client.js";
import { buildLookup, type ContentLookup } from "../content/lookup.js";

type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export type SidePanel = "feed" | "economy" | "scoreboard";

type ReviewState = {
  session: Load<SessionInfo>;
  matches: Load<MatchSummary[]>;
  replay: Load<MatchReplay>;
  content: Content | undefined;
  lookup: ContentLookup;
  selectedMatchId: string | undefined;
  roundIndex: number;
  /** Scrubber position, ms since round start. */
  t: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  panel: SidePanel;
  showCalibration: boolean;
  showCallouts: boolean;
  init: () => Promise<void>;
  loadMatches: () => Promise<void>;
  selectMatch: (matchId: string) => Promise<void>;
  selectRound: (index: number) => void;
  setTime: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  cycleSpeed: () => void;
  setPanel: (panel: SidePanel) => void;
  toggleCalibration: () => void;
  toggleCallouts: () => void;
};

export const useReview = create<ReviewState>((set, get) => ({
  session: { status: "idle" },
  matches: { status: "idle" },
  replay: { status: "idle" },
  content: undefined,
  lookup: buildLookup(undefined),
  selectedMatchId: undefined,
  roundIndex: 0,
  t: 0,
  playing: false,
  speed: 2,
  panel: "feed",
  showCalibration: false,
  showCallouts: true,

  init: async () => {
    // Content is decoration: failures leave the lookup empty and the UI falls back to ids.
    void fetchContent()
      .then((content) => set({ content, lookup: buildLookup(content) }))
      .catch(() => undefined);
    set({ session: { status: "loading" } });
    try {
      set({ session: { status: "ready", data: await fetchSession() } });
    } catch (err) {
      set({ session: { status: "error", message: errorMessage(err) } });
    }
    await get().loadMatches();
  },

  loadMatches: async () => {
    set({ matches: { status: "loading" } });
    try {
      const data = await fetchMatches();
      set({ matches: { status: "ready", data } });
      const first = data[0];
      if (first && !get().selectedMatchId) void get().selectMatch(first.matchId);
    } catch (err) {
      set({ matches: { status: "error", message: errorMessage(err) } });
    }
  },

  selectMatch: async (matchId) => {
    set({
      selectedMatchId: matchId,
      replay: { status: "loading" },
      roundIndex: 0,
      t: 0,
      playing: false,
    });
    try {
      const data = await fetchReplay(matchId);
      // Ignore a stale response if the user picked another match meanwhile.
      if (get().selectedMatchId === matchId) set({ replay: { status: "ready", data } });
    } catch (err) {
      if (get().selectedMatchId === matchId) {
        set({ replay: { status: "error", message: errorMessage(err) } });
      }
    }
  },

  selectRound: (index) => set({ roundIndex: index, t: 0, playing: false }),
  setTime: (t) => set({ t }),
  setPlaying: (playing) => set({ playing }),
  cycleSpeed: () => set((s) => ({ speed: s.speed === 1 ? 2 : s.speed === 2 ? 4 : 1 })),
  setPanel: (panel) => set({ panel }),
  toggleCalibration: () => set((s) => ({ showCalibration: !s.showCalibration })),
  toggleCallouts: () => set((s) => ({ showCallouts: !s.showCallouts })),
}));
