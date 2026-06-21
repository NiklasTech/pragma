import { create } from "zustand";

export type ProblemSeverity = "error" | "warning" | "info";

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  message: string;
  filePath: string;
  line: number;
  column: number;
  source: string;
}

interface ProblemsState {
  problems: Problem[];
  isLoading: boolean;
  error: string | null;
}

interface ProblemsActions {
  setProblems: (problems: Problem[]) => void;
  clearProblems: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  refreshProblems: () => Promise<void>;
  addProblem: (problem: Problem) => void;
  removeProblem: (id: string) => void;
}

export const useProblemsStore = create<ProblemsState & ProblemsActions>((set, get) => ({
  problems: [],
  isLoading: false,
  error: null,

  setProblems: (problems) => set({ problems, error: null }),
  clearProblems: () => set({ problems: [], error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  refreshProblems: async () => {
    set({ isLoading: true, error: null });
    try {
      // TODO: replace with a real diagnostics command (e.g. cargo check, tsc, eslint).
      await new Promise((resolve) => setTimeout(resolve, 400));
      const demo: Problem[] = get().problems.length > 0 ? get().problems : [];
      set({ problems: demo, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  addProblem: (problem) =>
    set((s) => ({
      problems: [...s.problems, problem],
      error: null,
    })),

  removeProblem: (id) =>
    set((s) => ({
      problems: s.problems.filter((p) => p.id !== id),
    })),
}));
