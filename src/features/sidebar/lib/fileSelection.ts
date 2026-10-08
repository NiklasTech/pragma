import { create } from "zustand";
import { isSameOrInside } from "@/shared/lib/fileDisk";

interface FileSelectionState {
  /** Explicit multi-selection; empty after a plain click. */
  paths: string[];
  /** Last plainly clicked or toggled row, where a Shift range starts. */
  anchor: string | null;
  reset: (anchor: string | null) => void;
  toggle: (path: string) => void;
  extend: (path: string, visiblePaths: string[]) => void;
}

/// Every visible row between the anchor and the target, inclusive.
export function rangeSelection(
  visiblePaths: string[],
  anchor: string | null,
  target: string,
): string[] {
  const end = visiblePaths.indexOf(target);
  const start = anchor ? visiblePaths.indexOf(anchor) : -1;
  if (end === -1 || start === -1) return [target];
  return visiblePaths.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/// Drops paths inside another selected folder, since acting on the folder covers them.
export function topLevelPaths(paths: string[]): string[] {
  return paths.filter(
    (path) => !paths.some((other) => other !== path && isSameOrInside(path, other)),
  );
}

export const useFileSelectionStore = create<FileSelectionState>((set, get) => ({
  paths: [],
  anchor: null,

  reset: (anchor) => set({ paths: [], anchor }),

  toggle: (path) => {
    const { paths, anchor } = get();
    const base = paths.length > 0 ? paths : anchor ? [anchor] : [];
    const next = base.includes(path) ? base.filter((p) => p !== path) : [...base, path];
    set({ paths: next, anchor: path });
  },

  extend: (path, visiblePaths) => {
    set({ paths: rangeSelection(visiblePaths, get().anchor ?? path, path) });
  },
}));

/// The rows an action on `path` applies to: the selection when `path` is part of it.
export function selectionTargets(path: string, paths: string[]): string[] {
  return paths.length > 1 && paths.includes(path) ? topLevelPaths(paths) : [path];
}
