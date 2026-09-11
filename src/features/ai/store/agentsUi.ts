import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AgentStatus } from "@/features/agent/store";

export const AGENTS_UI_STORAGE_KEY = "pragma.agents.ui";

export const CONTEXT_PANE_DEFAULT_WIDTH = 360;
export const CONTEXT_PANE_MIN_WIDTH = 320;
export const CONTEXT_PANE_MAX_WIDTH = 400;

interface AgentsUiState {
  contextPaneWidth: number;
  contextPaneCollapsed: boolean;
  setContextPaneWidth: (width: number) => void;
  setContextPaneCollapsed: (collapsed: boolean) => void;
}

function clampWidth(width: number): number {
  return Math.max(CONTEXT_PANE_MIN_WIDTH, Math.min(CONTEXT_PANE_MAX_WIDTH, width));
}

/// The pane stays collapsed on home and opens itself as soon as a run needs
/// review input or produced file changes.
export function shouldAutoOpenContextPane(input: {
  status: AgentStatus;
  editReviewCount: number;
  checkpointedCount: number;
}): boolean {
  if (input.status === "waiting-approval") return true;
  return input.editReviewCount > 0 || input.checkpointedCount > 0;
}

export const useAgentsUiStore = create<AgentsUiState>()(
  persist(
    (set) => ({
      contextPaneWidth: CONTEXT_PANE_DEFAULT_WIDTH,
      contextPaneCollapsed: true,
      setContextPaneWidth: (width) => set({ contextPaneWidth: clampWidth(width) }),
      setContextPaneCollapsed: (collapsed) => set({ contextPaneCollapsed: collapsed }),
    }),
    {
      name: AGENTS_UI_STORAGE_KEY,
      partialize: (state) => ({
        contextPaneWidth: state.contextPaneWidth,
        contextPaneCollapsed: state.contextPaneCollapsed,
      }),
    },
  ),
);
