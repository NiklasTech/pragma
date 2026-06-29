import { create } from "zustand";

export type ProblemSeverity = "error" | "warning" | "info";

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  message: string;
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  source: string;
}

interface ProblemsState {
  problems: Problem[];
  isLoading: boolean;
  error: string | null;
}

interface ProblemsActions {
  setProblems: (problems: Problem[]) => void;
  setPragmaDiagnostics: (diagnostics: Problem[]) => void;
  setFileDiagnostics: (filePath: string, diagnostics: Problem[]) => void;
  clearFileDiagnostics: (filePath: string) => void;
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

  setPragmaDiagnostics: (diagnostics) =>
    set((state) => {
      const nonPragma = state.problems.filter((p) => p.source !== "pragma");
      return { problems: [...nonPragma, ...diagnostics], error: null };
    }),

  setFileDiagnostics: (filePath, diagnostics) =>
    set((state) => {
      const others = state.problems.filter((p) => p.filePath !== filePath || p.source === "pragma");
      return { problems: [...others, ...diagnostics], error: null };
    }),

  clearFileDiagnostics: (filePath) =>
    set((state) => ({
      problems: state.problems.filter((p) => p.filePath !== filePath),
      error: null,
    })),

  clearProblems: () => set({ problems: [], error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  refreshProblems: async () => {
    set({ isLoading: true, error: null });
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      set({ problems: get().problems, isLoading: false });
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
