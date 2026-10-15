import { useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";

import { createGitRefreshQueue } from "@/shared/lib/gitRefreshQueue";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useRepositoryGitStore } from "@/shared/stores/repositoryGit";

import { inactiveRepositories } from "../lib/gitRepositories";

interface WorkspaceChange {
  root: string;
}

/// Loads the git status of the open repositories besides the active one and refreshes it on their watcher events.
export function useRepositoryGitSync(): void {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeRoot = useFileExplorerStore((state) => state.rootPath);
  const key = inactiveRepositories(paths, activeRoot).join("\n");
  const roots = useMemo(() => (key ? key.split("\n") : []), [key]);

  useEffect(() => {
    const store = useRepositoryGitStore.getState();
    for (const root of Object.keys(store.byRoot)) {
      if (!roots.includes(root)) store.unload(root);
    }
    const queues = new Map(
      roots.map((root) => [
        root,
        createGitRefreshQueue(() => useRepositoryGitStore.getState().loadStatus(root)),
      ]),
    );
    for (const refresh of queues.values()) refresh("status");

    const onChange = (event: { payload: WorkspaceChange }) => {
      queues.get(event.payload.root)?.("status");
    };
    const unlistenGit = listen<WorkspaceChange>("workspace-git-changed", onChange);
    const unlistenFs = listen<WorkspaceChange>("workspace-fs-changed", onChange);
    return () => {
      unlistenGit.then(unlistenQuietly).catch(() => {});
      unlistenFs.then(unlistenQuietly).catch(() => {});
    };
  }, [roots]);
}
