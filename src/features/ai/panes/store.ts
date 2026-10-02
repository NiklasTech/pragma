import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useBrowserHistoryStore } from "../browser/history";
import {
  assignLeafSession,
  countLeaves,
  createLeaf,
  findLeaf,
  findLeafBySession,
  firstLeaf,
  MAX_PANES,
  updateSplitSizes,
  type Leaf,
  type PaneRoot,
} from "./operations";
import { autoLayout, collectLeaves, swapLeaves } from "./layout";

export const AGENTS_PANES_STORAGE_KEY = "pragma.agents.panes.v1";

export type PanePreset = "focus" | "pair" | "grid";

const PRESET_SIZES: Record<PanePreset, number> = { focus: 1, pair: 2, grid: 4 };

export interface PaneTreeEntry {
  root: PaneRoot;
  focusedLeafId: string | null;
  focusOrder: string[];
}

interface AgentsPanesState {
  trees: Record<string, PaneTreeEntry>;
  openSession: (rootPath: string, sessionId: string) => void;
  assignSession: (rootPath: string, leafId: string, sessionId: string) => void;
  focusLeaf: (rootPath: string, leafId: string) => void;
  replaceLayout: (rootPath: string, sessionIds: string[]) => void;
  closeLeaf: (rootPath: string, leafId: string) => void;
  addPane: (rootPath: string, leaf: Leaf, focus: boolean) => void;
  swapPanes: (rootPath: string, sourceLeafId: string, targetLeafId: string) => void;
  applyPreset: (rootPath: string, preset: PanePreset, sessionIds: string[]) => void;
  syncSessions: (rootPath: string, sessionIds: string[]) => void;
  setSplitSizes: (rootPath: string, splitId: string, sizes: number[]) => void;
}

const EMPTY_ENTRY: PaneTreeEntry = { root: null, focusedLeafId: null, focusOrder: [] };

function getEntry(trees: Record<string, PaneTreeEntry>, rootPath: string): PaneTreeEntry {
  return trees[rootPath] ?? EMPTY_ENTRY;
}

function setEntry(
  trees: Record<string, PaneTreeEntry>,
  rootPath: string,
  entry: PaneTreeEntry,
): Record<string, PaneTreeEntry> {
  return { ...trees, [rootPath]: entry };
}

function promoteFocusOrder(focusOrder: string[], sessionId: string): string[] {
  if (focusOrder[0] === sessionId) return focusOrder;
  return [sessionId, ...focusOrder.filter((id) => id !== sessionId)];
}

function orderedSessions(focusOrder: string[], sessionIds: string[]): string[] {
  const known = focusOrder.filter((id) => sessionIds.includes(id));
  const rest = sessionIds.filter((id) => !known.includes(id));
  return [...known, ...rest];
}

export const useAgentsPanesStore = create<AgentsPanesState>()(
  persist(
    (set) => ({
      trees: {},

      openSession: (rootPath, sessionId) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const existing = findLeafBySession(entry.root, sessionId);
          if (!existing && countLeaves(entry.root) >= MAX_PANES) return {};

          const leaf = existing ?? createLeaf(sessionId);
          return {
            trees: setEntry(state.trees, rootPath, {
              root: existing
                ? entry.root
                : autoLayout([...collectLeaves(entry.root), leaf], entry.root),
              focusedLeafId: leaf.id,
              focusOrder: promoteFocusOrder(entry.focusOrder, sessionId),
            }),
          };
        }),

      assignSession: (rootPath, leafId, sessionId) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const root = assignLeafSession(entry.root, leafId, sessionId);
          if (root === entry.root) return {};
          return {
            trees: setEntry(state.trees, rootPath, {
              root,
              focusedLeafId: leafId,
              focusOrder: promoteFocusOrder(entry.focusOrder, sessionId),
            }),
          };
        }),

      focusLeaf: (rootPath, leafId) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const leaf = findLeaf(entry.root, leafId);
          if (!leaf) return {};
          const focusOrder = leaf.sessionId
            ? promoteFocusOrder(entry.focusOrder, leaf.sessionId)
            : entry.focusOrder;
          if (leafId === entry.focusedLeafId && focusOrder === entry.focusOrder) return {};
          return {
            trees: setEntry(state.trees, rootPath, { ...entry, focusedLeafId: leafId, focusOrder }),
          };
        }),

      replaceLayout: (rootPath, sessionIds) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const root = autoLayout(sessionIds.map((sessionId) => createLeaf(sessionId)));
          return {
            trees: setEntry(state.trees, rootPath, {
              root,
              focusedLeafId: firstLeaf(root)?.id ?? null,
              focusOrder: [
                ...sessionIds,
                ...entry.focusOrder.filter((id) => !sessionIds.includes(id)),
              ],
            }),
          };
        }),

      closeLeaf: (rootPath, leafId) => {
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const leaves = collectLeaves(entry.root);
          const index = leaves.findIndex((leaf) => leaf.id === leafId);
          if (index === -1) return {};

          const remaining = leaves.filter((leaf) => leaf.id !== leafId);
          const focusedLeafId =
            entry.focusedLeafId === leafId
              ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? null)
              : entry.focusedLeafId;
          return {
            trees: setEntry(state.trees, rootPath, {
              ...entry,
              root: autoLayout(remaining, entry.root),
              focusedLeafId,
            }),
          };
        });
        useBrowserHistoryStore.getState().drop(leafId);
      },

      addPane: (rootPath, leaf, focus) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          if (countLeaves(entry.root) >= MAX_PANES) return {};
          return {
            trees: setEntry(state.trees, rootPath, {
              ...entry,
              root: autoLayout([...collectLeaves(entry.root), leaf], entry.root),
              focusedLeafId: focus || !entry.focusedLeafId ? leaf.id : entry.focusedLeafId,
            }),
          };
        }),

      swapPanes: (rootPath, sourceLeafId, targetLeafId) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const root = swapLeaves(entry.root, sourceLeafId, targetLeafId);
          if (root === entry.root) return {};
          return {
            trees: setEntry(state.trees, rootPath, { ...entry, root, focusedLeafId: sourceLeafId }),
          };
        }),

      applyPreset: (rootPath, preset, sessionIds) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const ordered = orderedSessions(entry.focusOrder, sessionIds);
          const leaves = Array.from({ length: PRESET_SIZES[preset] }, (_, index) =>
            createLeaf(ordered[index] ?? null),
          );
          const root = autoLayout(leaves);
          return {
            trees: setEntry(state.trees, rootPath, {
              root,
              focusedLeafId: firstLeaf(root)?.id ?? null,
              focusOrder: ordered,
            }),
          };
        }),

      syncSessions: (rootPath, sessionIds) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const leaves = collectLeaves(entry.root);
          const kept = leaves.filter(
            (leaf) => leaf.sessionId === null || sessionIds.includes(leaf.sessionId),
          );
          const focusOrder = entry.focusOrder.filter((id) => sessionIds.includes(id));
          if (kept.length === leaves.length && focusOrder.length === entry.focusOrder.length) {
            return {};
          }

          const root = kept.length === leaves.length ? entry.root : autoLayout(kept, entry.root);
          const focusedLeafId =
            entry.focusedLeafId && findLeaf(root, entry.focusedLeafId)
              ? entry.focusedLeafId
              : (firstLeaf(root)?.id ?? null);
          return {
            trees: setEntry(state.trees, rootPath, { root, focusedLeafId, focusOrder }),
          };
        }),

      setSplitSizes: (rootPath, splitId, sizes) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const root = updateSplitSizes(entry.root, splitId, sizes);
          if (root === entry.root) return {};
          return {
            trees: setEntry(state.trees, rootPath, { ...entry, root }),
          };
        }),
    }),
    {
      name: AGENTS_PANES_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ trees: state.trees }),
      // Version 0 stored free splits and tab groups; every pane now sits in the automatic grid.
      migrate: (persisted) => {
        const trees = (persisted as { trees?: Record<string, PaneTreeEntry> } | null)?.trees ?? {};
        const migrated: Record<string, PaneTreeEntry> = {};
        for (const [rootPath, entry] of Object.entries(trees)) {
          migrated[rootPath] = { ...entry, root: autoLayout(collectLeaves(entry.root)) };
        }
        return { trees: migrated };
      },
    },
  ),
);

export function selectRoot(state: AgentsPanesState, rootPath: string): PaneRoot {
  return state.trees[rootPath]?.root ?? null;
}

export function selectFocusedSessionId(state: AgentsPanesState, rootPath: string): string | null {
  const entry = state.trees[rootPath];
  if (!entry || !entry.focusedLeafId) return null;
  return findLeaf(entry.root, entry.focusedLeafId)?.sessionId ?? null;
}

export function selectLeafCount(state: AgentsPanesState, rootPath: string): number {
  return countLeaves(state.trees[rootPath]?.root ?? null);
}
