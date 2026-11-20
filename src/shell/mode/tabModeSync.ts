import { useEffect } from "react";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activeTab, type SpaceTabKind } from "@/shared/stores/spaces/model";
import { useUiModeStore, type UiMode } from "./store";

function modeOf(kind: SpaceTabKind): UiMode {
  return kind === "code" ? "editor" : "agents";
}

function activeTabKind(): SpaceTabKind | undefined {
  const { spaces, activeSpaceId } = useOpenRepositoriesStore.getState();
  const space = spaces.find((candidate) => candidate.id === activeSpaceId);
  return space ? activeTab(space)?.kind : undefined;
}

/** The active tab decides the mode: a code tab shows the editor, agents and activity tabs the agents view. */
export function syncModeFromTab(): void {
  const kind = activeTabKind();
  if (!kind) return;
  const mode = modeOf(kind);
  if (useUiModeStore.getState().uiMode !== mode) useUiModeStore.setState({ uiMode: mode });
}

/** Code that switches the mode shows the matching tab of the active space. */
export function syncTabFromMode(mode: UiMode): void {
  const kind = activeTabKind();
  if (kind && modeOf(kind) === mode) return;
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
