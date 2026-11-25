import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { findSpaceByFolder, TAB_NAMES, type SpaceTab } from "@/shared/stores/spaces/model";

import { collectLeaves } from "./layout";
import { paneTreeKey, useAgentsPanesStore } from "./store";

/** The other agents tabs of the folder's space, which can take the pane of a session. */
export function otherAgentsTabs(rootPath: string): SpaceTab[] {
  const space = findSpaceByFolder(useOpenRepositoriesStore.getState().spaces, rootPath);
  const current = paneTreeKey(rootPath);
  return space?.tabs.filter((tab) => tab.kind === "agents" && tab.id !== current) ?? [];
}

/** Moves the pane of a session from the tab on screen to another tab, or to a new one, and follows it. */
export function movePaneToTab(rootPath: string, sessionId: string, toTab: string | null): void {
  const repositories = useOpenRepositoriesStore.getState();
  const space = findSpaceByFolder(repositories.spaces, rootPath);
  const fromTab = paneTreeKey(rootPath);
  const leaf = collectLeaves(useAgentsPanesStore.getState().trees[fromTab]?.root ?? null).find(
    (item) => item.sessionId === sessionId,
  );
  if (!space || !leaf) return;
  const count = space.tabs.filter((tab) => tab.kind === "agents").length;
  const target =
    toTab ?? repositories.addTab(space.id, `${TAB_NAMES.agents} ${count + 1}`, "agents");
  if (!target) return;
  if (useAgentsPanesStore.getState().movePane(fromTab, leaf.id, target)) {
    useOpenRepositoriesStore.getState().activateTab(space.id, target);
  }
}
