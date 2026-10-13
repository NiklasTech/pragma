import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { createGitRefreshQueue } from "@/shared/lib/gitRefreshQueue";

interface WorkspaceChange {
  root: string;
}

/// Reloads the git store when the branch, index, refs or files change outside Pragma.
export function useGitStateSync(): void {
  const rootPath = useFileExplorerStore((s) => s.rootPath);

  useEffect(() => {
    if (!rootPath || !isWorkspaceWindow()) return;

    const refresh = createGitRefreshQueue(async (kind) => {
      const git = useGitStore.getState();
      if (git.repoPath !== rootPath) return;
      await (kind === "all" ? git.refreshAll() : git.loadStatus());
    });
    const hasRepo = () => useGitStore.getState().snapshot !== null;

    const unlistenGit = listen<WorkspaceChange>("workspace-git-changed", (event) => {
      if (event.payload.root === rootPath) refresh("all");
    });
    const unlistenFs = listen<WorkspaceChange>("workspace-fs-changed", (event) => {
      if (event.payload.root === rootPath && hasRepo()) refresh("status");
    });

    let active = true;
    let unlistenFocus: UnlistenFn | null = null;
    void (async () => {
      try {
        const unlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
          if (payload && hasRepo()) refresh("status");
        });
        if (active) unlistenFocus = unlisten;
        else void unlistenQuietly(unlisten);
      } catch {
        // Tauri is unavailable outside the desktop runtime.
      }
    })();

    return () => {
      active = false;
      unlistenGit.then(unlistenQuietly).catch(() => {});
      unlistenFs.then(unlistenQuietly).catch(() => {});
      void unlistenQuietly(unlistenFocus);
    };
  }, [rootPath]);
}
