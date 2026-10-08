import { create } from "zustand";

export interface BreakpointEditTarget {
  file: string;
  line: number;
}

interface BreakpointEditorState {
  target: BreakpointEditTarget | null;
  openEditor: (target: BreakpointEditTarget) => void;
  closeEditor: () => void;
}

export const useBreakpointEditorStore = create<BreakpointEditorState>()((set) => ({
  target: null,
  openEditor: (target) => set({ target }),
  closeEditor: () => set({ target: null }),
}));
