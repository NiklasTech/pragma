import { useEffect } from "react";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { useExtensionToolBridge } from "./acpTools";
import { useExtensionEventSources } from "./events";
import { loadWorkspaceExtensions, stopAllExtensions } from "./host";
import { useExtensionKeybindings } from "./keybindings";
import { useExtensionsStore } from "./store";

export function useExtensions(): void {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  useExtensionEventSources();
  useExtensionKeybindings();
  useExtensionToolBridge();

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
