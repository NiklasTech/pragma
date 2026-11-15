import { create } from "zustand";

import type { PatchHunk, PatchLine } from "@/shared/lib/diffHunks";

/** A part the user undid, with the file as it was before, so the undo can be undone. */
export interface UndoneHunk {
  key: string;
  path: string;
  header: string;
  lines: PatchLine[];
  /** The file's content before the undo; null when the undo deleted a new file. */
  before: string;
  /** The file's content right after the undo; a restore only overwrites this. */
  after: string | null;
}

/// Names a part by its file and changed lines, so it keeps its name when other parts move it.
export function hunkKey(path: string, hunk: Pick<PatchHunk, "lines">): string {
  const changed = hunk.lines
    .filter((line) => line.type !== "context")
    .map((line) => `${line.type === "added" ? "+" : "-"}${line.content}`)
    .join("\n");
  return `${path}\n${changed}`;
}

export interface ReviewTally {
  total: number;
  kept: number;
  undone: number;
  open: number;
}

/// How far the review is: parts still in the diff count as kept or open, undone parts count apart.
export function reviewTally(
  liveKeys: readonly string[],
  kept: ReadonlySet<string>,
  undone: readonly UndoneHunk[],
): ReviewTally {
  const keptCount = liveKeys.filter((key) => kept.has(key)).length;
  const total = liveKeys.length + undone.length;
  return {
    total,
    kept: keptCount,
    undone: undone.length,
    open: liveKeys.length - keptCount,
  };
}

interface HunkReviewState {
  kept: Record<string, string[]>;
  undone: Record<string, UndoneHunk[]>;
  toggleKept: (sessionId: string, key: string) => void;
  addUndone: (sessionId: string, hunk: UndoneHunk) => void;
  removeUndone: (sessionId: string, key: string) => void;
  clear: (sessionId: string) => void;
}

const NONE: string[] = [];

export const useHunkReviewStore = create<HunkReviewState>()((set) => ({
  kept: {},
  undone: {},
  toggleKept: (sessionId, key) =>
    set((state) => {
      const current = state.kept[sessionId] ?? NONE;
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      return { kept: { ...state.kept, [sessionId]: next } };
    }),
  addUndone: (sessionId, hunk) =>
    set((state) => ({
      undone: {
        ...state.undone,
        [sessionId]: [
          ...(state.undone[sessionId] ?? []).filter((item) => item.key !== hunk.key),
          hunk,
        ],
      },
      kept: {
        ...state.kept,
        [sessionId]: (state.kept[sessionId] ?? NONE).filter((item) => item !== hunk.key),
      },
    })),
  removeUndone: (sessionId, key) =>
    set((state) => ({
      undone: {
        ...state.undone,
        [sessionId]: (state.undone[sessionId] ?? []).filter((item) => item.key !== key),
      },
    })),
  clear: (sessionId) =>
    set((state) => {
      const kept = { ...state.kept };
      const undone = { ...state.undone };
      delete kept[sessionId];
      delete undone[sessionId];
      return { kept, undone };
    }),
}));
