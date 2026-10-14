import { useEffect, useMemo, useRef } from "react";

import { repositorySessions, useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

/// The loaded sessions of one repository, the active one unless a root is given.
export function useRepositorySessions(rootPath?: string): ChatSession[] {
  const activeRoot = useFileExplorerStore((state) => state.rootPath) ?? "default";
  const root = rootPath ?? activeRoot;
  const chatSessions = useAIStore((state) => state.chatSessions);
  return useMemo(() => repositorySessions(chatSessions, root), [chatSessions, root]);
}

/// Loads the sessions of every open repository and drops those of a closed one from memory.
export function useOpenRepositorySessions(): void {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const loadedRef = useRef(new Set<string>());

  useEffect(() => {
    const { loadSessions, unloadSessions } = useAIStore.getState();
    const loaded = loadedRef.current;
    for (const path of paths) {
      if (loaded.has(path)) continue;
      loaded.add(path);
      void loadSessions(path, { activate: false }).catch(() => {});
    }
    for (const path of loaded) {
      if (paths.includes(path)) continue;
      loaded.delete(path);
      unloadSessions(path);
    }
  }, [paths]);
}
