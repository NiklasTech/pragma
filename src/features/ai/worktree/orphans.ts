import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import type { WorkEnvironment } from "@/shared/stores/ai";

import { autoRemoveWorktrees, isPragmaBranch, removeWorktree } from "./cleanup";

interface OrphanWorktree {
  id: string;
  path: string;
  branch: string | null;
  dirty: boolean;
}

const sweptRoots = new Set<string>();

/** Removes clean worktrees no environment references and reports dirty ones, once per workspace and app run. */
export async function removeOrphanWorktrees(rootPath: string): Promise<void> {
  if (rootPath === "default" || sweptRoots.has(rootPath) || !autoRemoveWorktrees()) return;
  sweptRoots.add(rootPath);

  const orphans = await invoke<OrphanWorktree[]>("git_session_worktree_orphans", {
    repoPath: rootPath,
  });
  for (const orphan of orphans) {
    if (orphan.dirty || !orphan.branch || !isPragmaBranch(orphan.branch)) continue;
    const worktree: WorkEnvironment = {
      id: orphan.id,
      rootPath,
      kind: "worktree",
      path: orphan.path,
      branch: orphan.branch,
      setupStatus: "ready",
      setupLog: "",
    };
    try {
      await removeWorktree(rootPath, worktree, false);
    } catch (err) {
      toast.error(`Could not remove the worktree: ${String(err)}`);
    }
  }

  const dirty = orphans.filter((orphan) => orphan.dirty);
  if (dirty.length === 0) return;
  toast.warning(
    dirty.length === 1
      ? "Kept a worktree no session uses"
      : `Kept ${dirty.length} worktrees no session uses`,
    {
      description: `Uncommitted changes in ${dirty.map((orphan) => orphan.path).join(", ")}`,
      duration: Infinity,
    },
  );
}
