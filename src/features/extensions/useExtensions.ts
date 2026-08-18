import { useEffect } from "react";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { loadWorkspaceExtensions, stopAllExtensions } from "./host";
import { useExtensionsStore } from "./store";

export function useExtensions(): void {
  const rootPath = useFileExplorerStore((s) => s.rootPath);

  useEffect(() => {
    if (!isWorkspaceWindow()) return;
    if (!rootPath) {
      stopAllExtensions();
      useExtensionsStore.getState().reset();
      return;
    }
    void loadWorkspaceExtensions(rootPath);
    return () => {
      stopAllExtensions();
      useExtensionsStore.getState().reset();
    };
  }, [rootPath]);
}
