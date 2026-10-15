import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

import { entryToNode, loadExpandedDirs, type DirEntry } from "@/shared/hooks/useFileExplorer";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { isRepositoryTree, repositoryNodes } from "../lib/repositoryTree";

/// Keeps the tree in the shape the explorer option asks for: all open repositories or the active one.
export function useRepositoryTree(): void {
  const showAll = useFileExplorerStore((state) => state.showAllRepositories);
  const tree = useFileExplorerStore((state) => state.tree);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const paths = useOpenRepositoriesStore((state) => state.paths);

  useEffect(() => {
    if (!rootPath) return;
    const store = useFileExplorerStore.getState();
    if (showAll) {
      if (isRepositoryTree(tree, paths)) return;
      store.setTree(repositoryNodes(paths, tree, rootPath));
      store.expandDir(rootPath);
      void loadExpandedDirs(rootPath);
      return;
    }
    if (!tree.some((node) => node.repositoryRoot)) return;
    store.setTree([]);
    void invoke<DirEntry[]>("list_directory", { path: rootPath })
      .then((entries) => {
        if (useFileExplorerStore.getState().rootPath !== rootPath) return;
        useFileExplorerStore.getState().setTree(entries.map(entryToNode));
        void loadExpandedDirs(rootPath);
      })
      .catch(() => {});
  }, [showAll, tree, paths, rootPath]);
}
