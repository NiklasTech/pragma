import { TAB_SELECT_SHORTCUTS } from "@/shared/lib/shortcuts";
import type { ShortcutActions } from "@/shared/hooks/useGlobalShortcuts";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

/// Shows the tab at this position in the active space; false lets the key through when there is none.
export function selectTabAt(index: number): boolean {
  const { spaces, activeSpaceId, activateTab } = useOpenRepositoriesStore.getState();
  const space = spaces.find((candidate) => candidate.id === activeSpaceId);
  const tab = space?.tabs[index];
  if (!space || !tab) return false;
  activateTab(space.id, tab.id);
  return true;
}

export function tabSelectActions(): ShortcutActions {
  return Object.fromEntries(
    TAB_SELECT_SHORTCUTS.map((id, index) => [id, () => selectTabAt(index)]),
  ) as ShortcutActions;
}
