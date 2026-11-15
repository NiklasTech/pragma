import { create } from "zustand";

export type InlineEditPhase =
  | { kind: "asking" }
  | { kind: "working" }
  | { kind: "result"; replacement: string; summary: string }
  | { kind: "error"; message: string };

interface InlineEditState {
  /** The open edit; one at a time across every editor. */
  id: number | null;
  /** The file the edit is in. */
  filePath: string;
  instruction: string;
  phase: InlineEditPhase;
  begin: (id: number, filePath: string) => void;
  setInstruction: (instruction: string) => void;
  setPhase: (id: number, phase: InlineEditPhase) => void;
  end: (id: number) => void;
}

export const useInlineEditStore = create<InlineEditState>()((set, get) => ({
  id: null,
  filePath: "",
  instruction: "",
  phase: { kind: "asking" },
  begin: (id, filePath) => set({ id, filePath, instruction: "", phase: { kind: "asking" } }),
  setInstruction: (instruction) => set({ instruction }),
  // A late answer for an edit that was closed meanwhile is dropped.
  setPhase: (id, phase) => {
    if (get().id === id) set({ phase });
  },
  end: (id) => {
    if (get().id === id) set({ id: null, instruction: "", phase: { kind: "asking" } });
  },
}));
