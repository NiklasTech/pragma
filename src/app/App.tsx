import { useMemo } from "react";
import { Layout } from "@/shell/layout";
import { WindowResizeHandles } from "@/shell/chrome/WindowResizeHandles";
import { Toaster } from "@/shared/components/ui/sonner";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useLayoutStore } from "@/shell/layout";
import { useAIInit } from "@/shared/hooks/useAIInit";
import { ThemeProvider } from "@/theme";
import { useGlobalShortcuts, type ShortcutActions } from "@/shared/hooks/useGlobalShortcuts";
import { useMemoryStats } from "@/shared/hooks/useMemoryStats";
import { useEditorStore } from "@/shared/stores/editor";
import { useTerminalStore } from "@/shared/stores/terminal";

export default function App() {
  useAIInit();
  useMemoryStats();

  const openFile = useOpenFile();
  const saveFile = useSaveFile();

  const actions = useMemo<ShortcutActions>(
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
        useTerminalStore.getState().addSession({
          id: crypto.randomUUID(),
          name: "Shell",
          type: "shell",
          isActive: true,
        });
      },
      "view.openSettings": () => {
        useLayoutStore.getState().addFloatingPanel("settings");
      },
      "ai.toggle": () => {
        useLayoutStore.getState().toggleAI();
      },
    }),
    [openFile, saveFile],
  );

  useGlobalShortcuts(actions);

  return (
    <ThemeProvider>
      <WindowResizeHandles />
      <Layout />
      <Toaster position="bottom-right" />
    </ThemeProvider>
  );
}
