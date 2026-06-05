import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useFileExplorerStore, type FileSystemNode } from "@/stores/fileExplorer";
import { useEditorStore } from "@/stores/editor";
import { detectLanguage } from "@/lib/language";

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

  const selectRoot = useCallback(async () => {
    let path: string | null = null;
    try {
      path = await open({ multiple: false, directory: true });
    } catch (err) {
      toast.error(`Failed to open dialog: ${String(err)}`);
      return;
    }
    if (typeof path !== "string" || path.length === 0) return;
    store.setRootPath(path);
    store.setIsLoading(true);
    try {
      const entries = await invoke<DirEntry[]>("list_directory", { path });
      store.setTree(entries.map(entryToNode));
    } catch (err) {
      toast.error(String(err));
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
        openFile({
          id: result.path,
          path: result.path,
          name: result.name,
          content: result.content,
          isModified: false,
          language: detectLanguage(result.name),
        });
        store.setSelectedPath(path);
      } catch (err) {
        toast.error(String(err));
      }
    },
    [openFile, store],
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
