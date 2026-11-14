import { create, type StateCreator } from "zustand";
import { persist, type PersistOptions } from "zustand/middleware";
import { isPathInside, normalizePath } from "@/features/ai/named-agents/folders";
import { getWindowScope } from "@/shared/lib/windowScope";
import {
  activateTab,
  addTab,
  closeTab,
  createSpace,
  findSpaceByFolder,
  migrateOpenRepositories,
  primaryFolder,
  renameTab,
  type Space,
  type SpacesSnapshot,
} from "./spaces/model";

interface OpenRepositoriesState extends SpacesSnapshot {
  /** Primary folder of every space, in the order the spaces were opened. */
  paths: string[];
  /** Primary folder of the active space. */
  activePath: string | null;
}

interface OpenRepositoriesActions {
  /** Opens a space for the path unless one holds it, activates it and returns the stored path. */
  add: (path: string) => string;
  activate: (path: string) => void;
  /** Closes the space of the path and returns the path that is active afterwards. */
  remove: (path: string) => string | null;
  clear: () => void;
  /** Adds a tab to the space and activates it; returns the new tab id. */
  addTab: (spaceId: string, name: string) => string | null;
  activateTab: (spaceId: string, tabId: string) => void;
  closeTab: (spaceId: string, tabId: string) => void;
  renameTab: (spaceId: string, tabId: string, name: string) => void;
}

export type OpenRepositoriesStore = OpenRepositoriesState & OpenRepositoriesActions;

const STORAGE_KEY = `pragma.open-repositories.v1.${getWindowScope()}`;

export function findRepository(paths: string[], path: string): string | null {
  const key = normalizePath(path);
  return paths.find((existing) => normalizePath(existing) === key) ?? null;
}

/// The innermost open repository that contains the path.
export function owningRepository(paths: readonly string[], path: string): string | null {
  return paths
    .filter((root) => isPathInside(root, path))
    .reduce<string | null>(
      (best, root) => (!best || root.length > best.length ? root : best),
      null,
    );
}

/** The full state for a set of spaces, with the folder fields older code reads. */
function withPaths(spaces: Space[], activeSpaceId: string | null): OpenRepositoriesState {
  const active = spaces.find((space) => space.id === activeSpaceId) ?? null;
  return {
    spaces,
    activeSpaceId: active?.id ?? null,
    paths: spaces.map(primaryFolder),
    activePath: active ? primaryFolder(active) : null,
  };
}

export const openRepositoriesStoreCreator: StateCreator<OpenRepositoriesStore> = (set, get) => {
  const updateSpace = (spaceId: string, update: (space: Space) => Space) => {
    const { spaces, activeSpaceId } = get();
    let changed = false;
    const next = spaces.map((space) => {
      if (space.id !== spaceId) return space;
      const updated = update(space);
      changed = updated !== space;
      return updated;
    });
    if (changed) set(withPaths(next, activeSpaceId));
  };

  return {
    ...withPaths([], null),

    add: (path) => {
      const { spaces } = get();
      const existing = findSpaceByFolder(spaces, path);
      if (existing) {
        set(withPaths(spaces, existing.id));
        return primaryFolder(existing);
      }
      const space = createSpace(path);
      set(withPaths([...spaces, space], space.id));
      return path;
    },

    activate: (path) => {
      const { spaces } = get();
      const existing = findSpaceByFolder(spaces, path);
      if (existing) set(withPaths(spaces, existing.id));
    },

    remove: (path) => {
      const { spaces, activeSpaceId, activePath } = get();
      const existing = findSpaceByFolder(spaces, path);
      if (!existing) return activePath;
      const index = spaces.indexOf(existing);
      const next = spaces.filter((space) => space !== existing);
      const nextActiveId =
        activeSpaceId === existing.id
          ? (next[Math.min(index, next.length - 1)]?.id ?? null)
          : activeSpaceId;
      const state = withPaths(next, nextActiveId);
      set(state);
      return state.activePath;
    },

    clear: () => set(withPaths([], null)),

    addTab: (spaceId, name) => {
      if (!get().spaces.some((space) => space.id === spaceId)) return null;
      const id = crypto.randomUUID();
      updateSpace(spaceId, (space) => addTab(space, name, id));
      return id;
    },

    activateTab: (spaceId, tabId) => updateSpace(spaceId, (space) => activateTab(space, tabId)),
    closeTab: (spaceId, tabId) => updateSpace(spaceId, (space) => closeTab(space, tabId)),
    renameTab: (spaceId, tabId, name) =>
      updateSpace(spaceId, (space) => renameTab(space, tabId, name)),
  };
};

interface LegacyOpenRepositories {
  paths?: string[];
  activePath?: string | null;
}

export const openRepositoriesPersistOptions: Omit<
  PersistOptions<OpenRepositoriesStore, SpacesSnapshot>,
  "name"
> = {
  version: 1,
  partialize: (state) => ({ spaces: state.spaces, activeSpaceId: state.activeSpaceId }),
  // Version 0 stored a flat list of folders; each becomes a space with one tab.
  migrate: (persisted, version) => {
    if (version === 0) {
      const legacy = (persisted ?? {}) as LegacyOpenRepositories;
      return migrateOpenRepositories(legacy.paths ?? [], legacy.activePath ?? null);
    }
    return persisted as SpacesSnapshot;
  },
  merge: (persisted, current) => {
    const snapshot = (persisted ?? {}) as Partial<SpacesSnapshot>;
    return { ...current, ...withPaths(snapshot.spaces ?? [], snapshot.activeSpaceId ?? null) };
  },
};

export const useOpenRepositoriesStore = create<OpenRepositoriesStore>()(
  persist(openRepositoriesStoreCreator, { name: STORAGE_KEY, ...openRepositoriesPersistOptions }),
);
