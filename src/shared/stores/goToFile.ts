import { create, type StateCreator } from "zustand";

export interface GoToFileEntry {
  path: string;
  name: string;
  relativePath: string;
  /** Lowercase name and relative path, computed once per listing. */
  nameKey: string;
  pathKey: string;
}

interface GoToFileState {
  isOpen: boolean;
  files: GoToFileEntry[];
  /** The folder `files` was listed from, so reopening shows them while they refresh. */
  filesRoot: string | null;
  isLoading: boolean;
  error: string | null;
}

interface GoToFileActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setFiles: (root: string | null, files: GoToFileEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const goToFileStoreCreator: StateCreator<GoToFileState & GoToFileActions> = (set) => ({
  isOpen: false,
  files: [],
  filesRoot: null,
  isLoading: false,
  error: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setFiles: (root, files) => set({ filesRoot: root, files }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
});

export const useGoToFileStore = create<GoToFileState & GoToFileActions>()(goToFileStoreCreator);
