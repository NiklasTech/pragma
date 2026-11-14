import { useEffect } from "react";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activeTab, type SpaceTabKind } from "@/shared/stores/spaces/model";
import { useUiModeStore, type UiMode } from "./store";

function modeOf(kind: SpaceTabKind): UiMode {
  return kind === "code" ? "editor" : "agents";
}

/** The active tab decides the mode: a code tab shows the editor, an agents tab the agent panes. */
export function syncModeFromTab(): void {
  const { spaces, activeSpaceId } = useOpenRepositoriesStore.getState();
  const space = spaces.find((candidate) => candidate.id === activeSpaceId);
  const kind = space ? activeTab(space)?.kind : undefined;
  if (!kind) return;
  const mode = modeOf(kind);
  if (useUiModeStore.getState().uiMode !== mode) useUiModeStore.setState({ uiMode: mode });
}

/** Code that switches the mode shows the matching tab of the active space. */
export function syncTabFromMode(mode: UiMode): void {
  useOpenRepositoriesStore.getState().activateTabKind(mode === "editor" ? "code" : "agents");
}

export function useTabModeSync(): void {
  useEffect(() => {
    syncModeFromTab();
    const unsubscribeTabs = useOpenRepositoriesStore.subscribe(syncModeFromTab);
    const unsubscribeMode = useUiModeStore.subscribe((state, previous) => {
      if (state.uiMode && state.uiMode !== previous.uiMode) syncTabFromMode(state.uiMode);
    });
    return () => {
      unsubscribeTabs();
      unsubscribeMode();
    };
  }, []);
}
