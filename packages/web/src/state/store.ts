import { create } from "zustand";
import type { MatchReplay, MatchSummary } from "@replay-lab/shared";
import { errorMessage, fetchMatches, fetchReplay } from "../api/client.js";

type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

type ReviewState = {
  matches: Load<MatchSummary[]>;
  replay: Load<MatchReplay>;
  selectedMatchId: string | undefined;
  roundIndex: number;
  /** Scrubber position, ms since round start. */
  t: number;
  showCalibration: boolean;
  loadMatches: () => Promise<void>;
  selectMatch: (matchId: string) => Promise<void>;
  selectRound: (index: number) => void;
  setTime: (t: number) => void;
  toggleCalibration: () => void;
};

export const useReview = create<ReviewState>((set, get) => ({
  matches: { status: "idle" },
  replay: { status: "idle" },
  selectedMatchId: undefined,
  roundIndex: 0,
  t: 0,
  showCalibration: false,

  loadMatches: async () => {
    set({ matches: { status: "loading" } });
    try {
      set({ matches: { status: "ready", data: await fetchMatches() } });
    } catch (err) {
      set({ matches: { status: "error", message: errorMessage(err) } });
    }
  },

  selectMatch: async (matchId) => {
    set({ selectedMatchId: matchId, replay: { status: "loading" }, roundIndex: 0, t: 0 });
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

  selectRound: (index) => set({ roundIndex: index, t: 0 }),
  setTime: (t) => set({ t }),
  toggleCalibration: () => set((s) => ({ showCalibration: !s.showCalibration })),
}));
