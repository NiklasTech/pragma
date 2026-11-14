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
  files: GoToFileEntry[];
  /** The folder `files` was listed from, so reopening shows them while they refresh. */
  filesRoot: string | null;
  isLoading: boolean;
  error: string | null;
}

interface GoToFileActions {
  setFiles: (root: string | null, files: GoToFileEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const goToFileStoreCreator: StateCreator<GoToFileState & GoToFileActions> = (set) => ({
  files: [],
  filesRoot: null,
  isLoading: false,
  error: null,

  setFiles: (root, files) => set({ filesRoot: root, files }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
});

export const useGoToFileStore = create<GoToFileState & GoToFileActions>()(goToFileStoreCreator);
