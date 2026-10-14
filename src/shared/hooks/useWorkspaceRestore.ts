import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
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
  encoding: string;
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
  const fileExplorerHydrated = useFileExplorerStore((s) => s._hasHydrated);
  const editorHydrated = useEditorStore((s) => s._hasHydrated);
  const { selectRoot } = useFileExplorer();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    if (!fileExplorerHydrated || !editorHydrated) return;
    didRun.current = true;
    const fileExplorer = useFileExplorerStore.getState();
    const editor = useEditorStore.getState();

    async function restore() {
      const folderParam = new URLSearchParams(window.location.search).get("folder");
      if (folderParam) {
        // Window labels are reused; drop editor state persisted for a previous folder.
        if (fileExplorer.rootPath && fileExplorer.rootPath !== folderParam) {
          useEditorStore.setState({ tabs: [], tabStates: [], activeTabId: null, activeTabIds: {} });
          useOpenRepositoriesStore.getState().clear();
        }
        await selectRoot(folderParam);
        return;
      }

      const cliPath = await invoke<string | null>("get_cli_project_path");
      if (cliPath) {
        await selectRoot(cliPath);
        return;
      }

      // Restore last opened folder.
      if (fileExplorer.rootPath) {
        try {
          const entries = await invoke<DirEntry[]>("list_directory", {
            path: fileExplorer.rootPath,
          });
          fileExplorer.setTree(entries.map(entryToNode));
          useOpenRepositoriesStore.getState().add(fileExplorer.rootPath);
        } catch {
          // Folder no longer exists; drop it and fall back to the next open repository.
          const next = useOpenRepositoriesStore.getState().remove(fileExplorer.rootPath);
          if (!next || !(await selectRoot(next))) fileExplorer.setRootPath(null);
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
            const result = await invoke<FileReadResult>("read_text_file", {
              path: tab.path,
              encoding: tab.encodingForced ? tab.encoding : null,
            });
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
                encoding: result.encoding,
                encodingForced: tab.encodingForced,
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
  }, [fileExplorerHydrated, editorHydrated, selectRoot]);
}
