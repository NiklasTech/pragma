import { create } from "zustand";
import type { CursorPosition } from "./editor";

export interface ClosedTab {
  path: string;
  cursor: CursorPosition | null;
}

export const MAX_CLOSED_TABS = 20;

interface ClosedTabsState {
  entries: ClosedTab[];
  push: (entry: ClosedTab) => void;
  pop: () => ClosedTab | null;
}

export const useClosedTabsStore = create<ClosedTabsState>()((set, get) => ({
  entries: [],

  push: (entry) => {
    const rest = get().entries.filter((e) => e.path !== entry.path);
    set({ entries: [...rest, entry].slice(-MAX_CLOSED_TABS) });
  },

  pop: () => {
    const { entries } = get();
    const last = entries[entries.length - 1];
    if (!last) return null;
    set({ entries: entries.slice(0, -1) });
    return last;
  },
}));
