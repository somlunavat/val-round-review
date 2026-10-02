import { create } from "zustand";

export type Page = "review" | "strats";

const fromHash = (): Page => (window.location.hash === "#strats" ? "strats" : "review");

type NavState = { page: Page; go: (page: Page) => void };

/** Top-level page, mirrored in the URL hash so #strats links straight to the board. */
export const useNav = create<NavState>((set) => ({
  page: fromHash(),
  go: (page) => {
    window.location.hash = page === "strats" ? "strats" : "";
    set({ page });
  },
}));

window.addEventListener("hashchange", () => useNav.setState({ page: fromHash() }));
