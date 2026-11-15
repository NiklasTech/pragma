import { invoke } from "@tauri-apps/api/core";

import { lineSelection, type PatchHunk } from "@/shared/lib/diffHunks";

import { hunkKey, useHunkReviewStore, type UndoneHunk } from "./hunkReview";
import { joinPath } from "./rows";

async function readFile(path: string): Promise<string | null> {
  try {
    return (await invoke<{ content: string }>("read_text_file", { path })).content;
  } catch {
    return null;
  }
}

/// Takes one part out of the worktree file. A new file has one part, so undoing it deletes the file.
export async function undoHunk(input: {
  sessionId: string;
  cwd: string;
  path: string;
  hunk: PatchHunk;
  untracked: boolean;
}): Promise<void> {
  const { sessionId, cwd, path, hunk, untracked } = input;
  const absolute = joinPath(cwd, path);
  const before = await readFile(absolute);
  if (before === null) throw new Error(`Could not read ${path}`);
  if (untracked) {
    await invoke("delete_file", { path: absolute });
  } else {
    await invoke("git_apply_lines", {
      repoPath: cwd,
      path,
      action: "discard",
      selection: lineSelection(hunk.lines),
    });
  }
  const undone: UndoneHunk = {
    key: hunkKey(path, hunk),
    path,
    header: hunk.header,
    lines: hunk.lines,
    before,
    after: untracked ? null : await readFile(absolute),
  };
  useHunkReviewStore.getState().addUndone(sessionId, undone);
}

/// Puts an undone part back by restoring the file, unless the file changed since the undo.
export async function restoreHunk(
  sessionId: string,
  cwd: string,
  undone: UndoneHunk,
): Promise<void> {
  const absolute = joinPath(cwd, undone.path);
  const current = await readFile(absolute);
  if (current !== undone.after) {
    throw new Error(`${undone.path} changed since the undo, so it was left as it is`);
  }
  await invoke("write_text_file", { path: absolute, content: undone.before });
  useHunkReviewStore.getState().removeUndone(sessionId, undone.key);
}
