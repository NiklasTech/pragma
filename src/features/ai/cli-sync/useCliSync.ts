import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { isProjectAgentPath } from "@/features/ai/named-agents/projectFile";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";
import { useFolderTrustStore } from "@/shared/stores/workspaceSettings/trust";

import { useCliSyncStore } from "./store";

const DEBOUNCE_MS = 400;
const PRAGMA_SKILL_PATH = /(^|\/)\.pragma\/skills\//;

function isSyncSource(path: string): boolean {
  return PRAGMA_SKILL_PATH.test(path.replace(/\\/g, "/")) || isProjectAgentPath(path);
}

/// Syncs `.pragma` skills and agents into the `cliSync` targets when a trusted folder opens,
/// when the setting changes and whenever a skill or agent file changes.
export function useCliSync(): void {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const trusted = useFolderTrustStore((state) => state.rootPath === rootPath && state.trusted);
  const cliSync = useWorkspaceSettingsStore((state) =>
    state.rootPath === rootPath ? state.settings?.cliSync : undefined,
  );

  useEffect(() => {
    useCliSyncStore.getState().reset(rootPath);
    if (!rootPath || !trusted || !cliSync) return;
    const sync = () => void useCliSyncStore.getState().sync(rootPath, cliSync.targets ?? []);
    sync();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unlisten = listen<{ root: string; paths: string[] }>("workspace-fs-changed", (event) => {
      if (event.payload.root !== rootPath || !event.payload.paths.some(isSyncSource)) return;
      clearTimeout(timer);
      timer = setTimeout(sync, DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [rootPath, trusted, cliSync]);
}
