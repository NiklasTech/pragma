import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { isWorkspaceWindow } from "@/shared/lib/windowScope";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { findRepository, useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useUiModeStore } from "@/shell/mode";
import {
  runningRepositorySessions,
  useCloseRepositoryRequestStore,
} from "@/features/ai/sessions/runningSessions";

const ACTIVATE_REPOSITORY_EVENT = "pragma:workspace:activate-repository";

/// Closes a repository; closing the active one activates the next, closing the last one shows the Agents home.
export function useCloseRepositoryNow(): (path: string) => Promise<void> {
  const { selectRoot } = useFileExplorer();

  return useCallback(
    async (path: string) => {
      const repositories = useOpenRepositoriesStore.getState();
      const previousActive = repositories.activePath;
      const closed = findRepository(repositories.paths, path) ?? path;
      const nextActive = repositories.remove(path);
      if (nextActive !== previousActive && !(nextActive && (await selectRoot(nextActive)))) {
        useFileExplorerStore.getState().setRootPath(null);
        useUiModeStore.getState().setUiMode("agents");
      }
      useFileExplorerStore.getState().forgetRepository(closed);
    },
    [selectRoot],
  );
}

/// Closes a repository, or asks first when sessions still run in it.
export function useCloseRepository(): (path: string) => Promise<void> {
  const closeNow = useCloseRepositoryNow();

  return useCallback(
    async (path: string) => {
      const running = runningRepositorySessions(path);
      if (running.length === 0) return closeNow(path);
      useCloseRepositoryRequestStore.setState({
        request: { path, sessionIds: running.map((session) => session.id) },
      });
    },
    [closeNow],
  );
}

/// Registers the open repositories with the Rust folder registry and activates the ones `pragma <path>` asks for.
export function useOpenRepositoriesSync(): void {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const { selectRoot } = useFileExplorer();

  useEffect(() => {
    if (isWorkspaceWindow()) {
      void invoke("update_window_folder", { folders: paths });
    }
  }, [paths]);

  useEffect(() => {
    if (!isWorkspaceWindow()) return;
    const unlisten = getCurrentWebviewWindow().listen<{ path: string }>(
      ACTIVATE_REPOSITORY_EVENT,
      (event) => void selectRoot(event.payload.path),
    );
    return () => {
      unlisten.then(unlistenQuietly).catch(() => {});
    };
  }, [selectRoot]);
}
