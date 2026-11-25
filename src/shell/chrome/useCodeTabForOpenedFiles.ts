import { useEffect } from "react";

import { useEditorStore } from "@/shared/stores/editor";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

/// A file or diff opened from the drawer over the agents shows in the code tab, and the drawer closes.
export function useCodeTabForOpenedFiles(active: boolean, close: () => void): void {
  useEffect(() => {
    if (!active) return;
    return useEditorStore.subscribe((state, previous) => {
      if (state.activeTabId === previous.activeTabId || state.activeTabId === null) return;
      useOpenRepositoriesStore.getState().activateTabKind("code");
      close();
    });
  }, [active, close]);
}
