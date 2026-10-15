import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { isSameOrInside, parentPath } from "@/shared/lib/fileDisk";
import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { owningRepository, useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useLayoutStore } from "@/shell/layout";
import { relativePath } from "@/features/ai/context/autoContext";
import { useComposerInsertStore } from "@/features/ai/mentions/composerInsert";
import { activeChatSession, revealChatSession } from "@/features/ai/revealChatSession";
import { startSession } from "@/features/ai/sessions/start";
import { movedPath, retargetTabs } from "@/features/editor/retargetTabs";
import { refreshFileTree } from "./fileTreeRefresh";

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function joinPath(dir: string, name: string): string {
  const separator = dir.includes("/") && !dir.includes("\\") ? "/" : "\\";
  return `${dir}${separator}${name}`;
}

/// False when the move would be a no-op or would put a folder inside itself.
export function canMoveInto(path: string, targetDir: string): boolean {
  return parentPath(path) !== targetDir && !isSameOrInside(targetDir, path);
}

/// The open repository a path belongs to, else the active one.
export function fileRepository(path: string): string | null {
  const paths = useOpenRepositoriesStore.getState().paths;
  return owningRepository(paths, path) ?? useFileExplorerStore.getState().rootPath;
}

export async function copyPaths(paths: string[], relative: boolean): Promise<void> {
  const text = paths
    .map((path) => (relative ? relativePath(fileRepository(path), path) : path))
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    toast.error(String(err));
  }
}

export async function revealInFileManager(path: string): Promise<void> {
  try {
    await invoke("reveal_in_file_manager", { path });
  } catch (err) {
    toast.error(String(err));
  }
}

export function openInTerminal(path: string, isDirectory: boolean): void {
  const cwd = isDirectory ? path : parentPath(path);
  const layout = useLayoutStore.getState();
  if (layout.terminal.mode === "hidden") layout.toggleTerminal();
  useTerminalStore.getState().addSession({
    id: crypto.randomUUID(),
    name: baseName(cwd),
    type: "shell",
    cwd,
    panelId: resolveDefaultTerminalPanelId(),
    isActive: true,
  });
}

export async function duplicatePath(path: string): Promise<void> {
  const rootPath = fileRepository(path);
  try {
    const copy = await invoke<string>("duplicate_path", { path });
    if (rootPath) await refreshFileTree(rootPath, [copy]);
  } catch (err) {
    toast.error(String(err));
  }
}

/// Moves each path into `targetDir`; open tabs follow the files to their new location.
export async function movePaths(paths: string[], targetDir: string): Promise<void> {
  const changed: string[] = [];
  for (const path of paths.filter((p) => canMoveInto(p, targetDir))) {
    const newPath = joinPath(targetDir, baseName(path));
    try {
      await invoke("rename_file", { oldPath: path, newPath });
    } catch (err) {
      toast.error(String(err));
      continue;
    }
    retargetTabs(path, newPath);
    const explorer = useFileExplorerStore.getState();
    const selected = explorer.selectedPath && movedPath(explorer.selectedPath, path, newPath);
    if (selected) explorer.setSelectedPath(selected);
    changed.push(path, newPath);
  }
  const roots = new Set(changed.flatMap((path) => fileRepository(path) ?? []));
  for (const root of roots) {
    await refreshFileTree(
      root,
      changed.filter((path) => fileRepository(path) === root),
    );
  }
}

/// Adds `@path` mentions to the focused session's composer, starting a session if none is open.
export async function addPathsToChat(paths: string[]): Promise<void> {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) return;
  let session = activeChatSession();
  if (!session) {
    try {
      session = await startSession(rootPath, {
        init: { kind: "agent", agentEngine: { kind: "builtin" } },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open a session");
      return;
    }
  }
  useComposerInsertStore
    .getState()
    .insert(paths.map((path) => `@${relativePath(rootPath, path)}`).join(" "));
  revealChatSession(session.id);
}
