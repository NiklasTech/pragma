import { create } from "zustand";

export interface FileSystemNode {
  path: string;
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  children?: FileSystemNode[];
  isLoading?: boolean;
  error?: string;
}

export interface VisibleFileNode {
  node: FileSystemNode;
  depth: number;
}

export function getVisibleNodes(
  nodes: FileSystemNode[],
  expandedDirs: Set<string>,
): VisibleFileNode[] {
  const result: VisibleFileNode[] = [];

  function walk(list: FileSystemNode[], depth: number) {
    for (const node of list) {
      result.push({ node, depth });
      if (node.isDirectory && node.children && expandedDirs.has(node.path)) {
        walk(node.children, depth + 1);
      }
    }
  }

  walk(nodes, 0);
  return result;
}

interface FileExplorerState {
  rootPath: string | null;
  expandedDirs: Set<string>;
  selectedPath: string | null;
  tree: FileSystemNode[];
  isLoading: boolean;
}

interface FileExplorerActions {
  setRootPath: (path: string | null) => void;
  setTree: (tree: FileSystemNode[]) => void;
  toggleDir: (path: string) => void;
  expandDir: (path: string) => void;
  collapseDir: (path: string) => void;
  setDirChildren: (path: string, children: FileSystemNode[]) => void;
  setDirError: (path: string, error: string) => void;
  setDirLoading: (path: string, loading: boolean) => void;
  setSelectedPath: (path: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  removeNode: (path: string) => void;
  renameNode: (oldPath: string, newPath: string, newName: string) => void;
  addNode: (parentPath: string, node: FileSystemNode) => void;
}

export const useFileExplorerStore = create<FileExplorerState & FileExplorerActions>((set, get) => ({
  rootPath: null,
  expandedDirs: new Set(),
  selectedPath: null,
  tree: [],
  isLoading: false,

  setRootPath: (path) => set({ rootPath: path, tree: [], expandedDirs: new Set() }),
  setTree: (tree) => set({ tree }),

  toggleDir: (path) => {
    const { expandedDirs } = get();
    const next = new Set(expandedDirs);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    set({ expandedDirs: next });
  },

  expandDir: (path) => {
    const { expandedDirs } = get();
    if (expandedDirs.has(path)) return;
    set({ expandedDirs: new Set(expandedDirs).add(path) });
  },

  collapseDir: (path) => {
    const { expandedDirs } = get();
    if (!expandedDirs.has(path)) return;
    const next = new Set(expandedDirs);
    next.delete(path);
    set({ expandedDirs: next });
  },

  setDirChildren: (path, children) => {
    const updateNode = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes.map((n) => {
        if (n.path === path) {
          return { ...n, children, isLoading: false, error: undefined };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    set({ tree: updateNode(get().tree) });
  },

  setDirError: (path, error) => {
    const updateNode = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes.map((n) => {
        if (n.path === path) {
          return { ...n, error, isLoading: false };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    set({ tree: updateNode(get().tree) });
  },

  setDirLoading: (path, loading) => {
    const updateNode = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes.map((n) => {
        if (n.path === path) {
          return { ...n, isLoading: loading };
        }
        if (n.children) {
          return { ...n, children: updateNode(n.children) };
        }
        return n;
      });
    set({ tree: updateNode(get().tree) });
  },

  setSelectedPath: (path) => set({ selectedPath: path }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  removeNode: (path) => {
    const filterNodes = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes
        .filter((n) => n.path !== path)
        .map((n) => (n.children ? { ...n, children: filterNodes(n.children) } : n));
    const nextSelected = get().selectedPath === path ? null : get().selectedPath;
    set({ tree: filterNodes(get().tree), selectedPath: nextSelected });
  },

  renameNode: (oldPath, newPath, newName) => {
    const renameInNodes = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes.map((n) => {
        if (n.path === oldPath) {
          return { ...n, path: newPath, name: newName };
        }
        if (n.children) {
          return { ...n, children: renameInNodes(n.children) };
        }
        return n;
      });
    set({ tree: renameInNodes(get().tree) });
  },

  addNode: (parentPath, node) => {
    const insertNode = (nodes: FileSystemNode[]): FileSystemNode[] =>
      nodes.map((n) => {
        if (n.path === parentPath && n.children) {
          const next = [...n.children, node];
          next.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          });
          return { ...n, children: next };
        }
        if (n.children) {
          return { ...n, children: insertNode(n.children) };
        }
        return n;
      });
    set({ tree: insertNode(get().tree) });
  },
}));
