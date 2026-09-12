import { useMemo } from "react";
import { useOpenFile } from "@/shared/hooks/useOpenFile";
import { useSaveFile } from "@/shared/hooks/useSaveFile";
import { useEditorStore } from "@/shared/stores/editor";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";
import { useLayoutStore } from "@/shell/layout";
import { resolveUiMode, useUiModeStore } from "@/shell/mode";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useGoToFileStore } from "@/shared/stores/goToFile";
import {
  dispatchEditorFind,
  dispatchEditorFormatDocument,
  dispatchEditorReplace,
} from "@/shared/lib/editor-events";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { type ShortcutActions } from "@/shared/hooks/useGlobalShortcuts";
import { debugCurrentFile } from "@/features/debug/debugCurrentFile";
import { useDebugStore } from "@/features/debug/store";
import { useAgentStore } from "@/features/agent/store";

function cycleTab(delta: 1 | -1): void {
  const { tabs, activeTabId, setActiveTab } = useEditorStore.getState();
  if (tabs.length < 2) return;
  const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
  const nextIndex =
    currentIndex === -1
      ? delta > 0
        ? 0
        : tabs.length - 1
      : (currentIndex + delta + tabs.length) % tabs.length;
  setActiveTab(tabs[nextIndex].id);
}

function toggleBreakpointAtCursor(): void {
  const { tabs, activeTabId, cursorPositions } = useEditorStore.getState();
  const tab = tabs.find((candidate) => candidate.id === activeTabId);
  if (!tab || tab.kind !== "file") return;
  const line = cursorPositions[tab.id]?.line;
  if (!line) return;
  useDebugStore.getState().toggleBreakpoint(tab.path, line);
}

export function useAppShortcutActions(): ShortcutActions {
  const openFile = useOpenFile();
  const saveFile = useSaveFile();
  const editorPanelId = useEditorPanelId();

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
          panelId: resolveDefaultTerminalPanelId(),
          isActive: true,
        });
      },
      "view.openSettings": () => {
        useLayoutStore.getState().addFloatingPanel("settings");
      },
      "view.switchToAgents": () => {
        useUiModeStore.getState().setUiMode("agents");
      },
      "view.switchToEditor": () => {
        useUiModeStore.getState().setUiMode("editor");
      },
      "view.toggleUiMode": () => {
        const { uiMode, setUiMode } = useUiModeStore.getState();
        const hasRootPath = useFileExplorerStore.getState().rootPath !== null;
        setUiMode(resolveUiMode(uiMode, hasRootPath) === "agents" ? "editor" : "agents");
      },
      "search.findInFiles": () => {
        const layout = useLayoutStore.getState();
        layout.setSidebarCollapsed(false);
        layout.setSidebarTab("search");
        window.dispatchEvent(new CustomEvent("focus-search"));
      },
      "search.find": () => {
        dispatchEditorFind();
      },
      "search.replace": () => {
        dispatchEditorReplace();
      },
      "ai.toggle": () => {
        useLayoutStore.getState().toggleAI();
      },
      "view.commandPalette": () => {
        useCommandPaletteStore.getState().toggle();
      },
      "file.goToFile": () => {
        useGoToFileStore.getState().toggle();
      },
      "editor.formatDocument": () => {
        dispatchEditorFormatDocument();
      },
      "tab.next": () => {
        cycleTab(1);
      },
      "tab.prev": () => {
        cycleTab(-1);
      },
      "view.splitEditor": () => {
        if (editorPanelId) {
          useLayoutStore.getState().splitPanel(editorPanelId, "horizontal", "editor");
        }
      },
      "view.toggleProblems": () => {
        useLayoutStore.getState().addFloatingPanel("problems");
      },
      "view.togglePreview": () => {
        useLayoutStore.getState().addFloatingPanel("preview");
      },
      "debug.currentFile": () => {
        const debug = useDebugStore.getState();
        if (debug.status === "running") {
          void debug.continueSession();
        } else {
          void debugCurrentFile();
        }
      },
      "debug.stop": () => {
        void useDebugStore.getState().stopSession();
      },
      "debug.stepOver": () => {
        void useDebugStore.getState().stepOver();
      },
      "debug.stepInto": () => {
        void useDebugStore.getState().stepInto();
      },
      "debug.stepOut": () => {
        void useDebugStore.getState().stepOut();
      },
      "debug.toggleBreakpoint": () => {
        toggleBreakpointAtCursor();
      },
      "agent.toggle": () => {
        const agent = useAgentStore.getState();
        agent.setModeActive(!agent.modeActive);
      },
    }),
    [openFile, saveFile, editorPanelId],
  );
}
