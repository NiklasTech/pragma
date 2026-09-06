import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import {
  buildReplaceWorkspaceRequest,
  isPathInsideRoot,
  isSameFilePath,
  replaceAllInContent,
  replaceOneMatchInContent,
  toReplaceQueryOptions,
  type ReplaceOneTarget,
  type ReplaceWorkspaceRequestExtra,
  type ReplaceWorkspaceResult,
  type SearchQueryState,
  type SearchResult,
  type SearchResultGroup,
} from "@/features/sidebar/lib/searchReplace";

function openFileTabForPath(path: string): FileTab | null {
  const { tabs } = useEditorStore.getState();
  return tabs.find((t): t is FileTab => t.kind === "file" && isSameFilePath(t.path, path)) ?? null;
}

function openTabPaths(): string[] {
  const root = useFileExplorerStore.getState().rootPath;
  if (!root) return [];
  const { tabs } = useEditorStore.getState();
  return tabs
    .filter((t): t is FileTab => t.kind === "file" && isPathInsideRoot(t.path, root))
    .map((t) => t.path);
}

export function useWorkspaceReplace({
  rootPath,
  state,
  grouped,
  onRefresh,
}: {
  rootPath: string | null;
  state: SearchQueryState;
  grouped: SearchResultGroup[];
  onRefresh: () => void;
}): {
  replacing: boolean;
  replaceOne: (result: SearchResult) => Promise<void>;
  replaceAllInFile: (path: string) => Promise<void>;
  replaceAllInWorkspace: () => Promise<void>;
} {
  const [replacing, setReplacing] = useState(false);

  const invokeReplace = useCallback(
    (extra?: ReplaceWorkspaceRequestExtra) => {
      if (!rootPath) {
        return Promise.resolve({ filesChanged: 0, replacementCount: 0 });
      }
      return invoke<ReplaceWorkspaceResult>(
        "replace_workspace",
        buildReplaceWorkspaceRequest(rootPath, state, extra),
      );
    },
    [rootPath, state],
  );

  const replaceOneInOpenTab = useCallback(
    (path: string, target: ReplaceOneTarget): boolean => {
      const tab = openFileTabForPath(path);
      if (!tab) return false;
      const result = replaceOneMatchInContent(
        tab.content,
        toReplaceQueryOptions(state),
        target,
        state.replacement,
      );
      if (result.replaced) {
        useEditorStore.getState().updateFileContent(tab.id, result.content);
      } else {
        toast.error("Match not found in the open file");
      }
      return true;
    },
    [state],
  );

  const replaceAllInOpenTab = useCallback(
    (path: string): { handled: boolean; replacementCount: number } => {
      const tab = openFileTabForPath(path);
      if (!tab) return { handled: false, replacementCount: 0 };
      const result = replaceAllInContent(
        tab.content,
        toReplaceQueryOptions(state),
        state.replacement,
      );
      if (result.replacementCount > 0) {
        useEditorStore.getState().updateFileContent(tab.id, result.content);
      }
      return { handled: true, replacementCount: result.replacementCount };
    },
    [state],
  );

  const replaceOne = useCallback(
    async (result: SearchResult) => {
      if (replacing) return;
      setReplacing(true);
      try {
        if (replaceOneInOpenTab(result.path, { line: result.line, column: result.column })) {
          onRefresh();
          return;
        }
        const response = await invokeReplace({
          skipPaths: openTabPaths(),
          singlePath: result.path,
          oneMatch: { path: result.path, line: result.line, column: result.column },
        });
        if (response.replacementCount === 0) {
          toast.info("No matches replaced");
        }
        onRefresh();
      } catch (err) {
        toast.error(String(err));
      } finally {
        setReplacing(false);
      }
    },
    [replacing, replaceOneInOpenTab, invokeReplace, onRefresh],
  );

  const replaceAllInFile = useCallback(
    async (path: string) => {
      if (replacing) return;
      setReplacing(true);
      try {
        const openResult = replaceAllInOpenTab(path);
        if (openResult.handled) {
          if (openResult.replacementCount === 0) {
            toast.info("No matches replaced");
          }
          onRefresh();
          return;
        }
        const response = await invokeReplace({ skipPaths: openTabPaths(), singlePath: path });
        if (response.replacementCount === 0) {
          toast.info("No matches replaced");
        }
        onRefresh();
      } catch (err) {
        toast.error(String(err));
      } finally {
        setReplacing(false);
      }
    },
    [replacing, replaceAllInOpenTab, invokeReplace, onRefresh],
  );

  const replaceAllInWorkspace = useCallback(async () => {
    if (replacing) return;
    setReplacing(true);
    try {
      const skipPaths = openTabPaths();
      const { tabs } = useEditorStore.getState();
      let filesChanged = 0;
      let replacementCount = 0;

      for (const group of grouped) {
        const tab = tabs.find(
          (t): t is FileTab => t.kind === "file" && isSameFilePath(t.path, group.path),
        );
        if (!tab) continue;
        const result = replaceAllInContent(
          tab.content,
          toReplaceQueryOptions(state),
          state.replacement,
        );
        if (result.replacementCount > 0) {
          useEditorStore.getState().updateFileContent(tab.id, result.content);
          filesChanged += 1;
          replacementCount += result.replacementCount;
        }
      }

      const response = await invokeReplace({ skipPaths });
      filesChanged += response.filesChanged;
      replacementCount += response.replacementCount;

      if (replacementCount > 0) {
        toast.success(
          `Replaced ${replacementCount} match${replacementCount === 1 ? "" : "es"} in ${filesChanged} file${filesChanged === 1 ? "" : "s"}`,
        );
      } else {
        toast.info("No matches replaced");
      }
      onRefresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setReplacing(false);
    }
  }, [replacing, grouped, state, invokeReplace, onRefresh]);

  return { replacing, replaceOne, replaceAllInFile, replaceAllInWorkspace };
}
