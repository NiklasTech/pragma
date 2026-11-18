import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import type { McpImportCandidate } from "./cliMcp";

/// The servers in the open folder, the coding CLI configs and Claude Desktop; read again
/// when the window gets focus, since the CLIs change their configs outside Pragma.
export function useCliMcpServers() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const [candidates, setCandidates] = useState<McpImportCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const found = await invoke<McpImportCandidate[]>("mcp_import_candidates", {
        workspaceRoot: rootPath,
      });
      setCandidates(found);
    } catch {
      setCandidates([]);
    } finally {
      setLoaded(true);
    }
  }, [rootPath]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { candidates, loaded, refresh };
}
