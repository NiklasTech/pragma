import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activeTab, findSpaceByFolder } from "@/shared/stores/spaces/model";

/// Sessions open in an agents tab: from the activity tab, the space's agents tab comes forward first.
export function showAgentsTabFor(rootPath: string): void {
  const repositories = useOpenRepositoriesStore.getState();
  const space = findSpaceByFolder(repositories.spaces, rootPath);
  if (!space || activeTab(space)?.kind !== "activity") return;
  const agents = space.tabs.find((tab) => tab.kind === "agents");
  if (agents) repositories.activateTab(space.id, agents.id);
  else if (space.id === repositories.activeSpaceId) repositories.activateTabKind("agents");
}
