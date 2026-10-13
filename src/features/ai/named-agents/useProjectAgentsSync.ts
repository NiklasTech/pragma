import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { isProjectAgentPath } from "./projectFile";
import { useNamedAgentsStore } from "./store";

/// Loads `.pragma/agents/` for the open folder and again whenever an agent file changes.
export function useProjectAgentsSync(): void {
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    const { loadProjectAgents } = useNamedAgentsStore.getState();
    void loadProjectAgents(rootPath);
    if (!rootPath) return;

    const unlisten = listen<{ root: string; paths: string[] }>("workspace-fs-changed", (event) => {
      if (event.payload.root !== rootPath) return;
      if (event.payload.paths.some(isProjectAgentPath)) void loadProjectAgents(rootPath);
    });
    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [rootPath]);
}
