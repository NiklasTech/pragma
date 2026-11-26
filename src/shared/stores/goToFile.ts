import { create, type StateCreator } from "zustand";

export interface GoToFileEntry {
  path: string;
  name: string;
  relativePath: string;
}

interface GoToFileState {
  /** The folder Go to last listed; its files stay searchable while a new listing runs. */
  filesRoot: string | null;
  /** Counts the listings, so open searches run again once a new one is done. */
  listing: number;
  isLoading: boolean;
  error: string | null;
}

interface GoToFileActions {
  setListed: (root: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const goToFileStoreCreator: StateCreator<GoToFileState & GoToFileActions> = (set) => ({
  filesRoot: null,
  listing: 0,
  isLoading: false,
  error: null,

  setListed: (root) => set((state) => ({ filesRoot: root, listing: state.listing + 1 })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
});

export const useGoToFileStore = create<GoToFileState & GoToFileActions>()(goToFileStoreCreator);
