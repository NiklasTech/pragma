import { create } from "zustand";

interface LspRetryState {
  /** Bumped after a language server was installed, so open files start it again. */
  attempt: number;
  retry: () => void;
}

export const useLspRetryStore = create<LspRetryState>((set) => ({
  attempt: 0,
  retry: () => set((state) => ({ attempt: state.attempt + 1 })),
}));
