import { create } from "zustand";

export interface BrowserHistory {
  entries: string[];
  index: number;
  reloadToken: number;
}

interface BrowserHistoryState {
  byLeaf: Record<string, BrowserHistory>;
  navigate: (leafId: string, url: string) => void;
  back: (leafId: string) => void;
  forward: (leafId: string) => void;
  reload: (leafId: string) => void;
  drop: (leafId: string) => void;
}

const EMPTY_HISTORY: BrowserHistory = { entries: [], index: -1, reloadToken: 0 };

export function currentUrl(history: BrowserHistory | undefined): string | null {
  if (!history) return null;
  return history.entries[history.index] ?? null;
}

export function pushUrl(history: BrowserHistory, url: string): BrowserHistory {
  if (history.entries[history.index] === url) {
    return { ...history, reloadToken: history.reloadToken + 1 };
  }
  const entries = [...history.entries.slice(0, history.index + 1), url];
  return { ...history, entries, index: entries.length - 1 };
}

export function stepHistory(history: BrowserHistory, delta: -1 | 1): BrowserHistory {
  const index = history.index + delta;
  if (index < 0 || index >= history.entries.length) return history;
  return { ...history, index };
}

function update(
  byLeaf: Record<string, BrowserHistory>,
  leafId: string,
  change: (history: BrowserHistory) => BrowserHistory,
): Record<string, BrowserHistory> {
  const history = byLeaf[leafId] ?? EMPTY_HISTORY;
  const next = change(history);
  return next === history ? byLeaf : { ...byLeaf, [leafId]: next };
}

/// Per-pane history; it lives in memory only, so closing the pane or the app drops it.
export const useBrowserHistoryStore = create<BrowserHistoryState>()((set) => ({
  byLeaf: {},
  navigate: (leafId, url) =>
    set((state) => ({ byLeaf: update(state.byLeaf, leafId, (history) => pushUrl(history, url)) })),
  back: (leafId) =>
    set((state) => ({
      byLeaf: update(state.byLeaf, leafId, (history) => stepHistory(history, -1)),
    })),
  forward: (leafId) =>
    set((state) => ({
      byLeaf: update(state.byLeaf, leafId, (history) => stepHistory(history, 1)),
    })),
  reload: (leafId) =>
    set((state) => ({
      byLeaf: update(state.byLeaf, leafId, (history) =>
        history.index < 0 ? history : { ...history, reloadToken: history.reloadToken + 1 },
      ),
    })),
  drop: (leafId) =>
    set((state) => {
      if (!(leafId in state.byLeaf)) return {};
      const byLeaf = { ...state.byLeaf };
      delete byLeaf[leafId];
      return { byLeaf };
    }),
}));
