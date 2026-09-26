import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { WorktreeChoice } from "./choice";

export const WORKTREE_CHOICE_STORAGE_KEY = "pragma.agents.worktree-choice.v1";

interface WorktreeChoiceState {
  choices: Record<string, WorktreeChoice>;
  setChoice: (workspaceRoot: string, choice: WorktreeChoice) => void;
}

export const useWorktreeChoiceStore = create<WorktreeChoiceState>()(
  persist(
    (set) => ({
      choices: {},
      setChoice: (workspaceRoot, choice) =>
        set((state) => ({ choices: { ...state.choices, [workspaceRoot]: choice } })),
    }),
    {
      name: WORKTREE_CHOICE_STORAGE_KEY,
      partialize: (state) => ({ choices: state.choices }),
    },
  ),
);

export function selectWorktreeChoice(
  state: WorktreeChoiceState,
  workspaceRoot: string,
): WorktreeChoice | undefined {
  return state.choices[workspaceRoot];
}
