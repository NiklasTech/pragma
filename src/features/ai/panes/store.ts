import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  assignLeafSession,
  closeLeaf as closeLeafOp,
  countLeaves,
  dockAsTab as dockAsTabOp,
  dropMissingSessions,
  findLeaf,
  firstLeaf,
  focusLeaf as focusLeafOp,
  focusPreset,
  gridPreset,
  openSession as openSessionOp,
  pairPreset,
  setActiveTab as setActiveTabOp,
  splitFocused,
  splitToward as splitTowardOp,
  updateSplitSizes,
  type PaneRoot,
  type SplitZone,
} from "./operations";

export const AGENTS_PANES_STORAGE_KEY = "pragma.agents.panes.v1";

export type PanePreset = "focus" | "pair" | "grid";

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
  splitRight: (rootPath: string) => void;
  splitDown: (rootPath: string) => void;
  closeLeaf: (rootPath: string, leafId: string) => void;
  selectTab: (rootPath: string, groupId: string, leafId: string) => void;
  dockAsTab: (rootPath: string, sourceLeafId: string, targetLeafId: string) => void;
  splitToward: (
    rootPath: string,
    sourceLeafId: string,
    targetLeafId: string,
    zone: SplitZone,
  ) => void;
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
          const result = openSessionOp(entry.root, entry.focusedLeafId, sessionId);
          return {
            trees: setEntry(state.trees, rootPath, {
              root: result.root,
              focusedLeafId: result.focusedLeafId,
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
          const root = focusLeafOp(entry.root, leafId);
          const focusOrder = leaf?.sessionId
            ? promoteFocusOrder(entry.focusOrder, leaf.sessionId)
            : entry.focusOrder;
          if (
            root === entry.root &&
            leafId === entry.focusedLeafId &&
            focusOrder === entry.focusOrder
          ) {
            return {};
          }
          return {
            trees: setEntry(state.trees, rootPath, {
              root,
              focusedLeafId: leafId,
              focusOrder,
            }),
          };
        }),

      splitRight: (rootPath) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const result = splitFocused(entry.root, entry.focusedLeafId, "horizontal");
          return {
            trees: setEntry(state.trees, rootPath, {
              ...entry,
              root: result.root,
              focusedLeafId: result.focusedLeafId,
            }),
          };
        }),

      splitDown: (rootPath) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const result = splitFocused(entry.root, entry.focusedLeafId, "vertical");
          return {
            trees: setEntry(state.trees, rootPath, {
              ...entry,
              root: result.root,
              focusedLeafId: result.focusedLeafId,
            }),
          };
        }),

      closeLeaf: (rootPath, leafId) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const result = closeLeafOp(entry.root, entry.focusedLeafId, leafId);
          return {
            trees: setEntry(state.trees, rootPath, {
              ...entry,
              root: result.root,
              focusedLeafId: result.focusedLeafId,
            }),
          };
        }),

      selectTab: (rootPath, groupId, leafId) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const root = setActiveTabOp(entry.root, groupId, leafId);
          const leaf = findLeaf(root, leafId);
          const focusOrder = leaf?.sessionId
            ? promoteFocusOrder(entry.focusOrder, leaf.sessionId)
            : entry.focusOrder;
          if (
            root === entry.root &&
            leafId === entry.focusedLeafId &&
            focusOrder === entry.focusOrder
          ) {
            return {};
          }
          return {
            trees: setEntry(state.trees, rootPath, {
              root,
              focusedLeafId: leafId,
              focusOrder,
            }),
          };
        }),

      dockAsTab: (rootPath, sourceLeafId, targetLeafId) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const root = dockAsTabOp(entry.root, sourceLeafId, targetLeafId);
          if (root === entry.root) return {};
          return {
            trees: setEntry(state.trees, rootPath, {
              ...entry,
              root,
              focusedLeafId: sourceLeafId,
            }),
          };
        }),

      splitToward: (rootPath, sourceLeafId, targetLeafId, zone) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const root = splitTowardOp(entry.root, sourceLeafId, targetLeafId, zone);
          if (root === entry.root) return {};
          return {
            trees: setEntry(state.trees, rootPath, {
              ...entry,
              root,
              focusedLeafId: sourceLeafId,
            }),
          };
        }),

      applyPreset: (rootPath, preset, sessionIds) =>
        set((state) => {
          const entry = getEntry(state.trees, rootPath);
          const ordered = orderedSessions(entry.focusOrder, sessionIds);
          const root =
            preset === "focus"
              ? focusPreset(ordered)
              : preset === "pair"
                ? pairPreset(ordered)
                : gridPreset(ordered);
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
          const root = dropMissingSessions(entry.root, sessionIds);
          const focusOrder = entry.focusOrder.filter((id) => sessionIds.includes(id));
          const focusedLeafId =
            entry.focusedLeafId && findLeaf(root, entry.focusedLeafId)
              ? entry.focusedLeafId
              : (firstLeaf(root)?.id ?? null);

          if (
            root === entry.root &&
            focusedLeafId === entry.focusedLeafId &&
            focusOrder.length === entry.focusOrder.length
          ) {
            return {};
          }

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
      partialize: (state) => ({ trees: state.trees }),
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
