import { useEffect } from "react";

import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useRepositorySettingsStore } from "@/shared/stores/workspaceSettings/repositories";

/// Caches settings and trust of every open repository, refreshed when the active one changes.
export function useOpenRepositorySettings(): void {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeRoot = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    const { byRoot, load, unload } = useRepositorySettingsStore.getState();
    for (const path of paths) void load(path);
    for (const root of Object.keys(byRoot)) {
      if (!paths.includes(root)) unload(root);
    }
  }, [paths, activeRoot]);
}
