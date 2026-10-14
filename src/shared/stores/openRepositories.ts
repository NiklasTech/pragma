import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { normalizePath } from "@/features/ai/named-agents/folders";
import { getWindowScope } from "@/shared/lib/windowScope";

interface OpenRepositoriesState {
  /** Absolute paths in the order they were opened. */
  paths: string[];
  activePath: string | null;
}

interface OpenRepositoriesActions {
  /** Adds the path unless an equal one is open, activates it and returns the stored path. */
  add: (path: string) => string;
  activate: (path: string) => void;
  /** Removes the path and returns the path that is active afterwards. */
  remove: (path: string) => string | null;
  clear: () => void;
}

export type OpenRepositoriesStore = OpenRepositoriesState & OpenRepositoriesActions;

const STORAGE_KEY = `pragma.open-repositories.v1.${getWindowScope()}`;

export function findRepository(paths: string[], path: string): string | null {
  const key = normalizePath(path);
  return paths.find((existing) => normalizePath(existing) === key) ?? null;
}

export const openRepositoriesStoreCreator: StateCreator<OpenRepositoriesStore> = (set, get) => ({
  paths: [],
  activePath: null,

  add: (path) => {
    const { paths } = get();
    const existing = findRepository(paths, path);
    if (existing) {
      set({ activePath: existing });
      return existing;
    }
    set({ paths: [...paths, path], activePath: path });
    return path;
  },

  activate: (path) => {
    const existing = findRepository(get().paths, path);
    if (existing) set({ activePath: existing });
  },

  remove: (path) => {
    const { paths, activePath } = get();
    const existing = findRepository(paths, path);
    if (!existing) return activePath;
    const index = paths.indexOf(existing);
    const next = paths.filter((p) => p !== existing);
    const nextActive =
      activePath === existing ? (next[Math.min(index, next.length - 1)] ?? null) : activePath;
    set({ paths: next, activePath: nextActive });
    return nextActive;
  },

  clear: () => set({ paths: [], activePath: null }),
});

export const useOpenRepositoriesStore = create<OpenRepositoriesStore>()(
  persist(openRepositoriesStoreCreator, {
    name: STORAGE_KEY,
    partialize: (state) => ({ paths: state.paths, activePath: state.activePath }),
  }),
);
