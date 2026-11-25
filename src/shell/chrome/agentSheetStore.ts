import { create } from "zustand";

interface AgentSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/// Whether the files and changes are shown over the agents, without leaving them for the code tab.
export const useAgentFilesStore = create<AgentSheetState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

/// Whether the sheet with every agent of the space is shown beside the rail.
export const useAgentSheetStore = create<AgentSheetState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
