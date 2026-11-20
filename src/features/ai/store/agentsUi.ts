import { create } from "zustand";
import { persist } from "zustand/middleware";

export const AGENTS_UI_STORAGE_KEY = "pragma.agents.ui";

interface AgentsUiState {
  /** The thread list stands beside the panes instead of sliding in over them. */
  threadsPinned: boolean;
  threadsOpen: boolean;
  setThreadsPinned: (pinned: boolean) => void;
  setThreadsOpen: (open: boolean) => void;
  toggleThreads: () => void;
}

export const useAgentsUiStore = create<AgentsUiState>()(
  persist(
    (set) => ({
      threadsPinned: false,
      threadsOpen: false,
      setThreadsPinned: (pinned) => set({ threadsPinned: pinned, threadsOpen: true }),
      setThreadsOpen: (open) => set({ threadsOpen: open }),
      toggleThreads: () => set((state) => ({ threadsOpen: !state.threadsOpen })),
    }),
    {
      name: AGENTS_UI_STORAGE_KEY,
      partialize: (state) => ({
        threadsPinned: state.threadsPinned,
        // An unpinned drawer always starts closed.
        threadsOpen: state.threadsPinned && state.threadsOpen,
      }),
    },
  ),
);
