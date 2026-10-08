import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useFileExplorerStore, type FileSystemNode } from "@/shared/stores/fileExplorer";
import { useEditorStore } from "@/shared/stores/editor";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { useRunConfigStore } from "@/shared/stores/runConfig";
import { useGitStore } from "@/shared/stores/git";
import { useDockerStore } from "@/shared/stores/docker";
import { useSettingsStore } from "@/shared/stores/settings";
import { detectLanguage } from "@/shared/lib/language";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { retargetTabs } from "@/features/editor/retargetTabs";

export interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

export function entryToNode(entry: DirEntry): FileSystemNode {
  return {
    path: entry.path,
    name: entry.name,
    isDirectory: entry.is_directory,
    isFile: entry.is_file,
    children: entry.is_directory ? [] : undefined,
  };
}

/// Explorer actions only; components that render tree state select it from the store themselves.
export function useFileExplorer() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const editorPanelId = useEditorPanelId();

  useEffect(() => {
    // Keep the Rust folder-dedup registry in sync so a second instance
    // opening the same folder focuses this window instead of duplicating it.
    if (isWorkspaceWindow()) {
      void invoke("update_window_folder", { folder: rootPath });
    }
    if (rootPath) {
      const runConfig = useRunConfigStore.getState();
      runConfig.setWorkspaceRoot(rootPath);
      useGitStore.getState().setRepoPath(rootPath);
      useDockerStore.getState().setWorkspaceRoot(rootPath);
      void runConfig.loadConfigs();
      void runConfig.detectConfigs();
    }
  }, [rootPath]);

  const selectRoot = useCallback(async (targetPath?: string) => {
    let path: string | null = targetPath ?? null;
    if (!path) {
      try {
        path = await open({ multiple: false, directory: true });
      } catch (err) {
        toast.error(`Failed to open dialog: ${String(err)}`);
        return false;
      }
    }
    if (typeof path !== "string" || path.length === 0) return false;
    const store = useFileExplorerStore.getState();
    store.setRootPath(path);
    useSettingsStore.getState().addRecentFolder(path);
    store.setIsLoading(true);
    try {
      const entries = await invoke<DirEntry[]>("list_directory", { path });
      store.setTree(entries.map(entryToNode));
      return true;
    } catch (err) {
      toast.error(String(err));
      return false;
    } finally {
      store.setIsLoading(false);
    }
  }, []);

  const loadDirectory = useCallback(async (path: string) => {
    const store = useFileExplorerStore.getState();
    store.setDirLoading(path, true);
    try {
      const entries = await invoke<DirEntry[]>("list_directory", { path });
      const children = entries.map(entryToNode);
      store.setDirChildren(path, children);
    } catch (err) {
      store.setDirError(path, String(err));
      toast.error(String(err));
    }
  }, []);

  const toggleDirectory = useCallback(
    async (path: string) => {
      const store = useFileExplorerStore.getState();
      const isExpanded = store.expandedDirs.has(path);
      if (isExpanded) {
        store.collapseDir(path);
        return;
      }
      store.expandDir(path);
      const node = findNode(store.tree, path);
      if (node && (!node.children || node.children.length === 0)) {
        await loadDirectory(path);
      }
    },
    [loadDirectory],
  );

  const openFileByPath = useCallback(
    async (path: string) => {
      try {
        const result = await invoke<FileReadResult>("read_text_file", { path });
        useEditorStore.getState().openFile(
          {
            id: result.path,
            path: result.path,
            name: result.name,
            content: result.content,
            originalContent: result.content,
            isModified: false,
            language: detectLanguage(result.name),
          },
          editorPanelId,
        );
        useFileExplorerStore.getState().setSelectedPath(path);
        useSettingsStore.getState().addRecentFile(path);
      } catch (err) {
        toast.error(String(err));
      }
    },
    [editorPanelId],
  );

  const createNode = useCallback(
    async (parentPath: string, name: string, isDirectory: boolean) => {
      const separator = parentPath.includes("/") && !parentPath.includes("\\") ? "/" : "\\";
      const path = `${parentPath}${separator}${name}`;
      try {
        if (isDirectory) {
          await invoke("create_directory", { path });
        } else {
          await invoke("create_file", { path });
        }
        const node: FileSystemNode = {
          path,
          name,
          isDirectory,
          isFile: !isDirectory,
          children: isDirectory ? [] : undefined,
        };
        const store = useFileExplorerStore.getState();
        store.addNode(parentPath, node);
        if (isDirectory) {
          store.expandDir(path);
          await loadDirectory(path);
        }
      } catch (err) {
        toast.error(String(err));
      }
    },
    [loadDirectory],
  );

  const renameNode = useCallback(async (oldPath: string, newName: string) => {
    const parent = oldPath.substring(
      0,
      Math.max(oldPath.lastIndexOf("/"), oldPath.lastIndexOf("\\")),
    );
    const separator = oldPath.includes("/") && !oldPath.includes("\\") ? "/" : "\\";
    const newPath = `${parent}${separator}${newName}`;
    try {
      await invoke("rename_file", { oldPath, newPath });
      useFileExplorerStore.getState().renameNode(oldPath, newPath, newName);
      retargetTabs(oldPath, newPath);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const deleteNode = useCallback(async (path: string) => {
    try {
      await invoke("delete_file", { path });
      useFileExplorerStore.getState().removeNode(path);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  return {
    selectRoot,
    loadDirectory,
    toggleDirectory,
    openFileByPath,
    createNode,
    renameNode,
    deleteNode,
  };
}

export function findNode(nodes: FileSystemNode[], path: string): FileSystemNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const found = findNode(n.children, path);
      if (found) return found;
    }
  }
  return null;
}
