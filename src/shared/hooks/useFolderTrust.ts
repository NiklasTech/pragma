import { useEffect } from "react";

import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useFolderTrustStore } from "@/shared/stores/workspaceSettings/trust";

/// Asks whether to trust a folder the first time it opens; other windows only read the decision.
export function useFolderTrust(): void {
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  useEffect(() => {
    void useFolderTrustStore.getState().load(rootPath, isWorkspaceWindow());
  }, [rootPath]);
}
