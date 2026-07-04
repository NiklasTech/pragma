import { useMemo } from "react";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useEditorStore } from "@/shared/stores/editor";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useLayoutStore } from "@/shell/layout";
import { type ShortcutActions } from "@/shared/hooks/useGlobalShortcuts";

export function useAppShortcutActions(): ShortcutActions {
  const openFile = useOpenFile();
  const saveFile = useSaveFile();

  return useMemo<ShortcutActions>(
    () => ({
      "file.open": () => {
        void openFile();
      },
      "file.save": () => {
        void saveFile();
      },
      "file.closeTab": () => {
        const { activeTabId, closeTab } = useEditorStore.getState();
        if (activeTabId) closeTab(activeTabId);
      },
      "view.toggleSidebar": () => {
        useLayoutStore.getState().toggleSidebar();
      },
      "view.toggleTerminal": () => {
        useLayoutStore.getState().toggleTerminal();
      },
      "view.newTerminalTab": () => {
        const layout = useLayoutStore.getState();
        if (layout.terminal.mode === "hidden") {
          layout.toggleTerminal();
        }
        const rootPath = useFileExplorerStore.getState().rootPath;
        useTerminalStore.getState().addSession({
          id: crypto.randomUUID(),
          name: "Shell",
          type: "shell",
          cwd: rootPath ?? undefined,
          isActive: true,
        });
      },
      "view.openSettings": () => {
        useLayoutStore.getState().addFloatingPanel("settings");
      },
      "search.findInFiles": () => {
        const layout = useLayoutStore.getState();
        layout.setSidebarCollapsed(false);
        layout.setSidebarTab("search");
        window.dispatchEvent(new CustomEvent("focus-search"));
      },
      "ai.toggle": () => {
        useLayoutStore.getState().toggleAI();
      },
    }),
    [openFile, saveFile],
  );
}
