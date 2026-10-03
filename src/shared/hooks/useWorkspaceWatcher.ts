import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { warn } from "@tauri-apps/plugin-log";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useEditorStore } from "@/shared/stores/editor";
import { useDiskStateStore } from "@/shared/stores/diskState";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { refreshFileTree } from "@/features/sidebar/lib/fileTreeRefresh";
import { syncTabsWithDisk } from "@/features/editor/diskSync";

interface WorkspaceFsChange {
  root: string;
  paths: string[];
}

/// Picks up changes made outside Pragma (CLI agents, git, other editors) in the file tree and open tabs.
export function useWorkspaceWatcher(): void {
  const rootPath = useFileExplorerStore((s) => s.rootPath);

  useEffect(() => {
    if (!rootPath || !isWorkspaceWindow()) return;

    const unlisten = listen<WorkspaceFsChange>("workspace-fs-changed", (event) => {
      if (event.payload.root !== rootPath) return;
      void refreshFileTree(rootPath, event.payload.paths);
      void syncTabsWithDisk(event.payload.paths);
    });
    invoke("workspace_watch", { root: rootPath }).catch((err: unknown) => {
      void warn(`Failed to watch ${rootPath}: ${String(err)}`);
    });

    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
      invoke("workspace_unwatch", { root: rootPath }).catch(() => {});
    };
  }, [rootPath]);

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
