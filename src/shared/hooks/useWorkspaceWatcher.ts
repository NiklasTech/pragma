import { useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { warn } from "@tauri-apps/plugin-log";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useEditorStore } from "@/shared/stores/editor";
import { useDiskStateStore } from "@/shared/stores/diskState";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { refreshFileTree } from "@/features/sidebar/lib/fileTreeRefresh";
import { syncTabsWithDisk } from "@/features/editor/diskSync";

interface WorkspaceFsChange {
  root: string;
  paths: string[];
}

/// Every open repository is watched, so tabs and git status of inactive repositories stay current.
export function watchedRoots(rootPath: string | null, paths: readonly string[]): string[] {
  if (!rootPath) return [];
  return paths.includes(rootPath) ? [...paths] : [rootPath, ...paths];
}

/// Whether the explorer tree shows the root: the active one, or every root while all are shown.
export function treeShowsRoot(root: string, rootPath: string | null, showAll: boolean): boolean {
  return showAll || root === rootPath;
}

/// Picks up changes made outside Pragma (CLI agents, git, other editors) in the file tree and open tabs.
export function useWorkspaceWatcher(): void {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const paths = useOpenRepositoriesStore((s) => s.paths);
  const rootsKey = watchedRoots(rootPath, paths).join("\n");
  const roots = useMemo(() => (rootsKey ? rootsKey.split("\n") : []), [rootsKey]);
  const watchedRef = useRef(new Set<string>());

  // Only added and removed roots change, so a root that stays is never unwatched and watched again out of order.
  useEffect(() => {
    if (!isWorkspaceWindow()) return;
    const watched = watchedRef.current;
    for (const root of roots) {
      if (watched.has(root)) continue;
      watched.add(root);
      invoke("workspace_watch", { root }).catch((err: unknown) => {
        void warn(`Failed to watch ${root}: ${String(err)}`);
      });
    }
    for (const root of watched) {
      if (roots.includes(root)) continue;
      watched.delete(root);
      invoke("workspace_unwatch", { root }).catch(() => {});
    }
  }, [roots]);

  useEffect(() => {
    const watched = watchedRef.current;
    return () => {
      for (const root of watched) invoke("workspace_unwatch", { root }).catch(() => {});
      watched.clear();
    };
  }, []);

  useEffect(() => {
    if (roots.length === 0 || !isWorkspaceWindow()) return;
    const unlisten = listen<WorkspaceFsChange>("workspace-fs-changed", (event) => {
      if (!roots.includes(event.payload.root)) return;
      const explorer = useFileExplorerStore.getState();
      if (treeShowsRoot(event.payload.root, explorer.rootPath, explorer.showAllRepositories)) {
        void refreshFileTree(event.payload.root, event.payload.paths);
      }
      void syncTabsWithDisk(event.payload.paths);
    });
    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [roots]);

  useEffect(
    () =>
      useEditorStore.subscribe((state, prev) => {
        if (state.tabs === prev.tabs) return;
        const openPaths = new Set(state.tabs.filter((t) => t.kind === "file").map((t) => t.path));
        useDiskStateStore.getState().retainPaths(openPaths);
      }),
    [],
  );
}
