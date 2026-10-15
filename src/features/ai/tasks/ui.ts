import { create } from "zustand";

interface TasksUiState {
  boardOpen: boolean;
  /** Repository the board shows; null shows the active repository. */
  boardRoot: string | null;
  openBoard: (rootPath?: string) => void;
  pickBoardRoot: (rootPath: string) => void;
  closeBoard: () => void;
}

export const useTasksUiStore = create<TasksUiState>()((set) => ({
  boardOpen: false,
  boardRoot: null,
  openBoard: (rootPath) => set({ boardOpen: true, boardRoot: rootPath ?? null }),
  pickBoardRoot: (rootPath) => set({ boardRoot: rootPath }),
  closeBoard: () => set({ boardOpen: false }),
}));
