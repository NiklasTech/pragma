import { create } from "zustand";

export type NamedAgentsView = "sessions" | "agents";

interface NamedAgentsUiState {
  view: NamedAgentsView;
  selectedAgentId: string | null;
  creatingAgent: boolean;
  formAgentId: string | null;
  setView: (view: NamedAgentsView) => void;
  selectAgent: (agentId: string | null) => void;
  startCreatingAgent: () => void;
  startEditingAgent: (agentId: string) => void;
  closeAgentForm: () => void;
}

export const useNamedAgentsUiStore = create<NamedAgentsUiState>()((set) => ({
  view: "sessions",
  selectedAgentId: null,
  creatingAgent: false,
  formAgentId: null,
  setView: (view) => set({ view }),
  selectAgent: (agentId) =>
    set({ selectedAgentId: agentId, creatingAgent: false, formAgentId: null }),
  startCreatingAgent: () => set({ view: "agents", creatingAgent: true, formAgentId: null }),
  startEditingAgent: (agentId) =>
    set({ view: "agents", creatingAgent: false, formAgentId: agentId }),
  closeAgentForm: () => set({ creatingAgent: false, formAgentId: null }),
}));
