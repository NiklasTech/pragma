import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";

const SETTINGS_FILE = /[\\/]\.pragma[\\/]settings\.json$/;

/// Loads `.pragma/settings.json` for the open folder and again whenever the file changes.
export function useWorkspaceSettingsSync(): void {
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    const { load } = useWorkspaceSettingsStore.getState();
    void load(rootPath);
    if (!rootPath) return;

    const unlisten = listen<{ root: string; paths: string[] }>("workspace-fs-changed", (event) => {
      if (event.payload.root !== rootPath) return;
      if (event.payload.paths.some((path) => SETTINGS_FILE.test(path))) void load(rootPath);
    });
    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [rootPath]);
}
