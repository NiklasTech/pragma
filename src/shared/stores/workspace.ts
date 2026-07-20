import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "./editor";
import { useTerminalStore } from "./terminal";
import { useRunConfigStore } from "./runConfig";
import { useLayoutStore } from "@/shell/layout/store";
import type { FloatingNode, LayoutNode, SidebarTab } from "@/shell/layout";

export interface WorkspaceCursorPosition {
  line: number;
  column: number;
}

export interface WorkspaceFileTab {
  kind: "file";
  id: string;
  path: string;
  name: string;
  language?: string;
}

export interface WorkspaceDiffTab {
  kind: "diff";
  id: string;
  path: string;
  name: string;
  staged: boolean;
}

export type WorkspaceTab = WorkspaceFileTab | WorkspaceDiffTab;

export interface WorkspaceLayout {
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarTab: string;
  chatPanelOpen: boolean;
  chatPanelWidth: number;
  terminalHeight: number;
  root: LayoutNode;
  floating: FloatingNode[];
}

export interface WorkspaceData {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  cursorPositions: Record<string, WorkspaceCursorPosition>;
  layout: WorkspaceLayout;
  terminalCwd: string | null;
  activeRunConfig: string | null;
}

export interface WorkspaceSaveResult {
  success: boolean;
  error?: string;
}

export interface WorkspaceLoadResult {
  success: boolean;
  data?: WorkspaceData;
  error?: string;
}

export async function saveWorkspace(
  repoPath: string,
  branchName: string,
): Promise<WorkspaceSaveResult> {
  if (!repoPath || !branchName) {
    return { success: false, error: "repo path and branch name are required" };
  }

  const editor = useEditorStore.getState();
  const terminal = useTerminalStore.getState();
  const runConfig = useRunConfigStore.getState();
  const layout = useLayoutStore.getState();

  const activeSession = terminal.sessions.find((s) => s.id === terminal.activeSessionId);

  const tabs: WorkspaceTab[] = editor.tabs.flatMap((t): WorkspaceTab[] => {
    if (t.kind === "file") {
      return [
        {
          kind: "file" as const,
          id: t.id,
          path: t.path,
          name: t.name,
          language: t.language,
        },
      ];
    }
    if (t.kind === "diff") {
      return [
        {
          kind: "diff" as const,
          id: t.id,
          path: t.path,
          name: t.name,
          staged: t.staged,
        },
      ];
    }
    return [];
  });

  const data: WorkspaceData = {
    tabs,
    activeTabId: editor.activeTabId,
    cursorPositions: editor.cursorPositions,
    layout: {
      sidebarOpen: !layout.sidebar.collapsed && layout.sidebar.position !== "hidden",
      sidebarWidth: layout.sidebar.width,
      sidebarTab: layout.sidebar.tab,
      chatPanelOpen: layout.ai.mode !== "hidden",
      chatPanelWidth: layout.ai.size,
      terminalHeight: layout.terminal.height,
      root: layout.root,
      floating: layout.floating,
    },
    terminalCwd: activeSession?.cwd ?? null,
    activeRunConfig: runConfig.activeProcessId,
  };

  try {
    await invoke("workspace_save", { repoPath, branchName, data });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function loadWorkspace(
  repoPath: string,
  branchName: string,
): Promise<WorkspaceLoadResult> {
  if (!repoPath || !branchName) {
    return { success: false, error: "repo path and branch name are required" };
  }

  try {
    const data = await invoke<WorkspaceData | null>("workspace_load", {
      repoPath,
      branchName,
    });

    if (!data) {
      return { success: true };
    }

    const editor = useEditorStore.getState();
    const layout = useLayoutStore.getState();
    const terminal = useTerminalStore.getState();
    const runConfig = useRunConfigStore.getState();

    editor.tabs.forEach((t) => editor.closeTab(t.id));

    for (const tab of data.tabs) {
      if (tab.kind === "file") {
        editor.openFile({
          id: tab.id,
          path: tab.path,
          name: tab.name,
          content: "",
          originalContent: "",
          isModified: false,
          language: tab.language,
        });
      } else {
        editor.openDiff({
          id: tab.id,
          path: tab.path,
          original: "",
          modified: "",
          patchText: "",
          staged: tab.staged,
        });
      }
    }

    if (data.activeTabId && editor.tabs.some((t) => t.id === data.activeTabId)) {
      editor.setActiveTab(data.activeTabId);
    }

    Object.entries(data.cursorPositions).forEach(([tabId, pos]) => {
      editor.setCursorPosition(tabId, pos);
    });

    layout.setSidebarCollapsed(!data.layout.sidebarOpen);
    layout.setSidebarWidth(data.layout.sidebarWidth);
    layout.setSidebarTab(data.layout.sidebarTab as SidebarTab);
    layout.setAIMode(data.layout.chatPanelOpen ? "drawer-right" : "hidden");
    layout.setAISize(data.layout.chatPanelWidth);
    layout.setTerminalHeight(data.layout.terminalHeight);

    if (data.layout.root) {
      layout.setRoot(data.layout.root);
    }
    if (data.layout.floating) {
      // Overwrite floating array entirely to restore saved state.
      useLayoutStore.setState({ floating: data.layout.floating });
    }

    if (data.terminalCwd && terminal.activeSessionId) {
      terminal.updateSessionCwd(terminal.activeSessionId, data.terminalCwd);
    }

    if (data.activeRunConfig) {
      runConfig.setActiveProcess(data.activeRunConfig);
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function hasWorkspace(repoPath: string, branchName: string): Promise<boolean> {
  if (!repoPath || !branchName) return false;
  try {
    const data = await invoke<WorkspaceData | null>("workspace_load", {
      repoPath,
      branchName,
    });
    return data !== null;
  } catch {
    return false;
  }
}
