import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { activityTabId, codeTabId, firstTabId } from "@/shared/stores/spaces/model";

import { showAgentsTabFor } from "./agentsTabFor";

function activeTabId(): string | undefined {
  const { spaces, activeSpaceId } = useOpenRepositoriesStore.getState();
  return spaces.find((space) => space.id === activeSpaceId)?.activeTabId;
}

describe("showAgentsTabFor", () => {
  beforeEach(() => {
    useOpenRepositoriesStore.getState().clear();
    useOpenRepositoriesStore.getState().add("/a");
  });

  it("brings the agents tab forward from the activity tab", () => {
    useOpenRepositoriesStore.getState().activateTabKind("activity");
    expect(activeTabId()).toBe(activityTabId("/a"));
    showAgentsTabFor("/a");
    expect(activeTabId()).toBe(firstTabId("/a"));
  });

  it("leaves the code tab and agents tabs alone", () => {
    useOpenRepositoriesStore.getState().activateTabKind("code");
    showAgentsTabFor("/a");
    expect(activeTabId()).toBe(codeTabId("/a"));
  });
});
