import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
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

function entryToNode(entry: DirEntry) {
  return {
    path: entry.path,
    name: entry.name,
    isDirectory: entry.is_directory,
    isFile: entry.is_file,
    children: entry.is_directory ? [] : undefined,
  };
}

export function useWorkspaceRestore(): void {
  const fileExplorer = useFileExplorerStore();
  const editor = useEditorStore();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    if (!fileExplorer._hasHydrated || !editor._hasHydrated) return;
    didRun.current = true;

    async function restore() {
      // Restore last opened folder.
      if (fileExplorer.rootPath) {
        try {
          const entries = await invoke<DirEntry[]>("list_directory", {
            path: fileExplorer.rootPath,
          });
          fileExplorer.setTree(entries.map(entryToNode));
        } catch {
          // Folder no longer exists; clear it.
          fileExplorer.setRootPath(null);
        }
      }

      // Restore previously opened file tabs.
      const persistedTabs = editor.tabs.filter((t): t is FileTab => t.kind === "file");
      const targetActiveId = editor.activeTabId;
      if (persistedTabs.length > 0) {
        // Clear stale (content-stripped) tabs and reopen from disk.
        useEditorStore.setState({ tabs: [], tabStates: [], activeTabId: null, activeTabIds: {} });
        const openedIds = new Set<string>();
        for (const tab of persistedTabs) {
          if (openedIds.has(tab.path)) continue;
          try {
            const result = await invoke<FileReadResult>("read_text_file", { path: tab.path });
            openedIds.add(result.path);
            editor.openFile(
              {
                id: result.path,
                path: result.path,
                name: result.name,
                content: result.content,
                originalContent: result.content,
                isModified: false,
                language: detectLanguage(result.name),
              },
              null,
            );
          } catch {
            // File no longer exists; skip it.
          }
        }
        // Restore previously active tab if it is still available.
        if (targetActiveId && openedIds.has(targetActiveId)) {
          useEditorStore.setState({ activeTabId: targetActiveId });
        }
      }
    }

    void restore();
  }, [fileExplorer._hasHydrated, editor._hasHydrated]);
}
