import { create } from "zustand";

interface TasksUiState {
  boardOpen: boolean;
  openBoard: () => void;
  closeBoard: () => void;
}

export const useTasksUiStore = create<TasksUiState>()((set) => ({
  boardOpen: false,
  openBoard: () => set({ boardOpen: true }),
  closeBoard: () => set({ boardOpen: false }),
}));
