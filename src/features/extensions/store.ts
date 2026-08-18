import { create, type StateCreator } from "zustand";
import type { ExtensionSummary } from "./types";

export type ExtensionStatus = "running" | "error" | "disabled";

export interface ExtensionRuntimeState {
  status: ExtensionStatus;
  error?: string;
}

export interface RegisteredPanel {
  extensionId: string;
  id: string;
  title: string;
  icon?: string;
  html?: string;
}

interface ExtensionsState {
  workspaceRoot: string | null;
  summaries: ExtensionSummary[];
  statuses: Record<string, ExtensionRuntimeState>;
  panels: RegisteredPanel[];
}

interface ExtensionsActions {
  setWorkspaceRoot: (root: string | null) => void;
  setSummaries: (summaries: ExtensionSummary[]) => void;
  setStatus: (id: string, status: ExtensionRuntimeState) => void;
  setPanelsFor: (extensionId: string, panels: RegisteredPanel[]) => void;
  reset: () => void;
}

const initialState: ExtensionsState = {
  workspaceRoot: null,
  summaries: [],
  statuses: {},
  panels: [],
};

const extensionsStoreCreator: StateCreator<ExtensionsState & ExtensionsActions> = (set) => ({
  ...initialState,

  setWorkspaceRoot: (workspaceRoot) => set({ workspaceRoot }),

  setSummaries: (summaries) => set({ summaries }),

  setStatus: (id, status) => set((state) => ({ statuses: { ...state.statuses, [id]: status } })),

  setPanelsFor: (extensionId, panels) =>
    set((state) => ({
      panels: [
        ...state.panels.filter((p) => p.extensionId !== extensionId),
        ...panels.map((p) => ({ ...p, extensionId })),
      ],
    })),

  reset: () => set({ ...initialState, workspaceRoot: null }),
});

export const useExtensionsStore = create<ExtensionsState & ExtensionsActions>()(
  extensionsStoreCreator,
);
