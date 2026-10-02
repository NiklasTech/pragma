import { create } from "zustand";

interface PaneMaximizeState {
  /** Maximized pane group per workspace folder. */
  maximized: Record<string, string>;
  toggle: (rootPath: string, groupId: string) => void;
  restore: (rootPath: string) => void;
}

export const usePaneMaximizeStore = create<PaneMaximizeState>()((set) => ({
  maximized: {},

  toggle: (rootPath, groupId) =>
    set((state) => {
      const next = { ...state.maximized };
      if (next[rootPath] === groupId) delete next[rootPath];
      else next[rootPath] = groupId;
      return { maximized: next };
    }),

  restore: (rootPath) =>
    set((state) => {
      if (!(rootPath in state.maximized)) return {};
      const next = { ...state.maximized };
      delete next[rootPath];
      return { maximized: next };
    }),
}));
