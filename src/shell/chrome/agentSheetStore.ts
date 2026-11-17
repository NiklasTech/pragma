import { create } from "zustand";

interface AgentSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/// Whether the sheet with every agent of the space is shown beside the rail.
export const useAgentSheetStore = create<AgentSheetState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
