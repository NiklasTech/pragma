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
import { detectLanguage } from "@/shared/lib/language";

interface DirEntry {
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

function entryToNode(entry: DirEntry): FileSystemNode {
  return {
    path: entry.path,
    name: entry.name,
    isDirectory: entry.is_directory,
    isFile: entry.is_file,
    children: entry.is_directory ? [] : undefined,
  };
}

export function useFileExplorer() {
  const store = useFileExplorerStore();
  const { openFile } = useEditorStore();
  const editorPanelId = useEditorPanelId();
  const { setWorkspaceRoot, loadConfigs } = useRunConfigStore();
  const { setRepoPath } = useGitStore();
  const { setWorkspaceRoot: setDockerWorkspaceRoot } = useDockerStore();

  useEffect(() => {
    if (store.rootPath) {
      setWorkspaceRoot(store.rootPath);
      setRepoPath(store.rootPath);
      setDockerWorkspaceRoot(store.rootPath);
      void loadConfigs();
    }
  }, [store.rootPath, setWorkspaceRoot, setRepoPath, setDockerWorkspaceRoot, loadConfigs]);

  const selectRoot = useCallback(async () => {
    let path: string | null = null;
    try {
      path = await open({ multiple: false, directory: true });
    } catch (err) {
      toast.error(`Failed to open dialog: ${String(err)}`);
      return false;
    }
    if (typeof path !== "string" || path.length === 0) return false;
    store.setRootPath(path);
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
  }, [store]);

  const loadDirectory = useCallback(
    async (path: string) => {
      store.setDirLoading(path, true);
      try {
        const entries = await invoke<DirEntry[]>("list_directory", { path });
        const children = entries.map(entryToNode);
        store.setDirChildren(path, children);
      } catch (err) {
        store.setDirError(path, String(err));
        toast.error(String(err));
      }
    },
    [store],
  );

  const toggleDirectory = useCallback(
    async (path: string) => {
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
    [store, loadDirectory],
  );

  const openFileByPath = useCallback(
    async (path: string) => {
      try {
        const result = await invoke<FileReadResult>("read_text_file", { path });
        openFile(
          {
            id: result.path,
            path: result.path,
            name: result.name,
            content: result.content,
            isModified: false,
            language: detectLanguage(result.name),
          },
          editorPanelId,
        );
        store.setSelectedPath(path);
      } catch (err) {
        toast.error(String(err));
      }
    },
    [openFile, store, editorPanelId],
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
        store.addNode(parentPath, node);
        if (isDirectory) {
          store.expandDir(path);
          await loadDirectory(path);
        }
      } catch (err) {
        toast.error(String(err));
      }
    },
    [store, loadDirectory],
  );

  const renameNode = useCallback(
    async (oldPath: string, newName: string) => {
      const parent = oldPath.substring(
        0,
        Math.max(oldPath.lastIndexOf("/"), oldPath.lastIndexOf("\\")),
      );
      const separator = oldPath.includes("/") && !oldPath.includes("\\") ? "/" : "\\";
      const newPath = `${parent}${separator}${newName}`;
      try {
        await invoke("rename_file", { oldPath, newPath });
        store.renameNode(oldPath, newPath, newName);
      } catch (err) {
        toast.error(String(err));
      }
    },
    [store],
  );

  const deleteNode = useCallback(
    async (path: string) => {
      try {
        await invoke("delete_file", { path });
        store.removeNode(path);
      } catch (err) {
        toast.error(String(err));
      }
    },
    [store],
  );

  return {
    rootPath: store.rootPath,
    tree: store.tree,
    expandedDirs: store.expandedDirs,
    selectedPath: store.selectedPath,
    isLoading: store.isLoading,
    selectRoot,
    loadDirectory,
    toggleDirectory,
    openFileByPath,
    createNode,
    renameNode,
    deleteNode,
    setSelectedPath: store.setSelectedPath,
  };
}

function findNode(nodes: FileSystemNode[], path: string): FileSystemNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const found = findNode(n.children, path);
      if (found) return found;
    }
  }
  return null;
}
