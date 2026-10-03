import { invoke } from "@tauri-apps/api/core";
import { useFileExplorerStore, type FileSystemNode } from "@/shared/stores/fileExplorer";
import { entryToNode, findNode, type DirEntry } from "@/shared/hooks/useFileExplorer";
import { parentPath } from "@/shared/lib/fileDisk";

/// Directories whose listing may have changed: the parent of every changed path and the path itself.
export function changedDirectories(paths: string[]): Set<string> {
  const dirs = new Set<string>();
  for (const path of paths) {
    dirs.add(path);
    dirs.add(parentPath(path));
  }
  return dirs;
}

/// Takes a fresh listing but keeps known nodes, so loaded subtrees survive the refresh.
export function mergeChildren(
  previous: FileSystemNode[],
  next: FileSystemNode[],
): FileSystemNode[] {
  const known = new Map(previous.map((node) => [node.path, node]));
  return next.map((node) => {
    const prior = known.get(node.path);
    return prior && prior.isDirectory === node.isDirectory ? prior : node;
  });
}

async function listChildren(path: string): Promise<FileSystemNode[] | null> {
  try {
    const entries = await invoke<DirEntry[]>("list_directory", { path });
    return entries.map(entryToNode);
  } catch {
    // The directory itself was removed; its parent refresh drops it from the tree.
    return null;
  }
}

/// Re-lists the root and every loaded folder that contains a changed path.
export async function refreshFileTree(rootPath: string, changedPaths: string[]): Promise<void> {
  const { tree, expandedDirs } = useFileExplorerStore.getState();
  const targets = [...changedDirectories(changedPaths)].filter((dir) => {
    if (dir === rootPath) return true;
    const node = findNode(tree, dir);
    return node?.isDirectory === true && (expandedDirs.has(dir) || Boolean(node.children?.length));
  });

  await Promise.all(
    targets.map(async (dir) => {
      const children = await listChildren(dir);
      if (!children) return;
      const store = useFileExplorerStore.getState();
      if (store.rootPath !== rootPath) return;
      if (dir === rootPath) {
        store.setTree(mergeChildren(store.tree, children));
        return;
      }
      const node = findNode(store.tree, dir);
      if (node) store.setDirChildren(dir, mergeChildren(node.children ?? [], children));
    }),
  );
}
