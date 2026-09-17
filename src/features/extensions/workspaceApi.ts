import { invoke } from "@tauri-apps/api/core";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import type { EditorSelection, WorkspaceEntry, WorkspaceFile } from "./types";

interface RustDirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

function activeFileTab(): FileTab | null {
  const { tabs, activeTabId } = useEditorStore.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  return tab && tab.kind === "file" ? tab : null;
}

export async function readWorkspaceFile(
  workspaceRoot: string,
  path: string,
): Promise<WorkspaceFile> {
  return invoke<WorkspaceFile>("extension_workspace_read_file", { workspaceRoot, path });
}

export async function writeWorkspaceFile(
  workspaceRoot: string,
  path: string,
  content: string,
): Promise<void> {
  await invoke("extension_workspace_write_file", { workspaceRoot, path, content });
}

export async function listWorkspace(
  workspaceRoot: string,
  path: string,
): Promise<WorkspaceEntry[]> {
  const entries = await invoke<RustDirEntry[]>("extension_workspace_list", {
    workspaceRoot,
    path,
  });
  return entries.map((entry) => ({
    path: entry.path,
    name: entry.name,
    isDirectory: entry.is_directory,
  }));
}

export function getActiveEditorText(): string | null {
  const tab = activeFileTab();
  return tab ? tab.content : null;
}

export function setActiveEditorText(text: string): void {
  const tab = activeFileTab();
  if (!tab) {
    throw new Error("No active editor");
  }
  useEditorStore.getState().updateFileContent(tab.id, text);
}

export function getActiveEditorSelection(): EditorSelection | null {
  const tab = activeFileTab();
  if (!tab) return null;
  return useEditorStore.getState().cursorPositions[tab.id] ?? null;
}
