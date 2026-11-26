import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { entryToNode, findNode, type DirEntry } from "@/shared/hooks/useFileExplorer";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { createGitRefreshQueue } from "@/shared/lib/gitRefreshQueue";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";
import type { GitStatusSnapshot } from "@/shared/stores/git/types";
import { syncTabsWithDisk } from "@/features/editor/diskSync";

import { changedDirectories } from "../lib/fileTreeRefresh";
import { useWorktreeViewStore } from "./worktreeView";
import { withListing } from "./treeListing";

interface WorkspaceChange {
  root: string;
  paths: string[];
}

const NO_DIRS: string[] = [];

export interface WorktreeFiles {
  tree: FileSystemNode[];
  expandedDirs: Set<string>;
  toggleDir: (dir: string) => void;
  snapshot: GitStatusSnapshot | null;
}

/// A worktree's own tree and git status, kept current by a watcher of the worktree folder.
export function useWorktreeFiles(root: string): WorktreeFiles {
  const [tree, setTree] = useState<FileSystemNode[]>([]);
  const [snapshot, setSnapshot] = useState<GitStatusSnapshot | null>(null);
  const open = useWorktreeViewStore((state) => state.expanded[root] ?? NO_DIRS);
  const expandedDirs = useMemo(() => new Set(open), [open]);
  const treeRef = useRef(tree);
  const openRef = useRef(expandedDirs);
  useEffect(() => {
    treeRef.current = tree;
    openRef.current = expandedDirs;
  }, [tree, expandedDirs]);

  const list = useCallback(
    async (dir: string) => {
      try {
        const entries = await invoke<DirEntry[]>("list_directory", { path: dir });
        setTree((prev) => withListing(prev, root, dir, entries.map(entryToNode)));
      } catch {
        // A folder removed meanwhile drops out with its parent's next listing.
      }
    },
    [root],
  );

  const loadStatus = useCallback(async () => {
    try {
      const result = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", {
        repoPath: root,
      });
      setSnapshot(result.snapshot);
    } catch {
      setSnapshot(null);
    }
  }, [root]);

  useEffect(() => {
    let live = true;
    void loadStatus();
    void (async () => {
      await list(root);
      // Parents first, so every open folder finds its node.
      const dirs = [...(useWorktreeViewStore.getState().expanded[root] ?? [])].sort(
        (a, b) => a.length - b.length,
      );
      for (const dir of dirs) {
        if (!live) return;
        await list(dir);
      }
    })();
    return () => {
      live = false;
    };
  }, [root, list, loadStatus]);

  useEffect(() => {
    invoke("workspace_watch", { root }).catch(() => {});
    // One status reload at a time, paced, while an agent keeps writing files.
    const refresh = createGitRefreshQueue(loadStatus);
    const unlistenFs = listen<WorkspaceChange>("workspace-fs-changed", (event) => {
      if (event.payload.root !== root) return;
      for (const dir of changedDirectories(event.payload.paths)) {
        const node = findNode(treeRef.current, dir);
        if (dir === root || (node?.isDirectory && openRef.current.has(dir))) void list(dir);
      }
      refresh("status");
      void syncTabsWithDisk(event.payload.paths);
    });
    const unlistenGit = listen<WorkspaceChange>("workspace-git-changed", (event) => {
      if (event.payload.root === root) refresh("all");
    });
    return () => {
      invoke("workspace_unwatch", { root }).catch(() => {});
      unlistenFs.then(unlistenQuietly).catch(() => {});
      unlistenGit.then(unlistenQuietly).catch(() => {});
    };
  }, [root, list, loadStatus]);

  const toggleDir = useCallback(
    (dir: string) => {
      const opening = !openRef.current.has(dir);
      useWorktreeViewStore.getState().toggleDir(root, dir);
      if (opening) void list(dir);
    },
    [root, list],
  );

  return { tree, expandedDirs, toggleDir, snapshot };
}
