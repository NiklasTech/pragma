import { create, type StateCreator } from "zustand";

export interface GoToFileEntry {
  path: string;
  name: string;
}

interface GoToFileState {
  isOpen: boolean;
  files: GoToFileEntry[];
  isLoading: boolean;
  error: string | null;
}

interface GoToFileActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setFiles: (files: GoToFileEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const goToFileStoreCreator: StateCreator<GoToFileState & GoToFileActions> = (set) => ({
  isOpen: false,
  files: [],
  isLoading: false,
  error: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setFiles: (files) => set({ files }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
});

export const useGoToFileStore = create<GoToFileState & GoToFileActions>()(goToFileStoreCreator);
