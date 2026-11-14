import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { codeTabId, firstTabId } from "@/shared/stores/spaces/model";
import { useUiModeStore } from "./store";
import { syncModeFromTab, syncTabFromMode } from "./tabModeSync";

function activeTabId(): string | undefined {
  const { spaces, activeSpaceId } = useOpenRepositoriesStore.getState();
  return spaces.find((space) => space.id === activeSpaceId)?.activeTabId;
}

describe("tab and mode sync", () => {
  beforeEach(() => {
    useOpenRepositoriesStore.getState().clear();
    useOpenRepositoriesStore.getState().add("/a");
    useUiModeStore.setState({ uiMode: null });
  });

  it("shows the editor for a code tab and the agent panes for an agents tab", () => {
    const spaceId = useOpenRepositoriesStore.getState().spaces[0].id;
    useOpenRepositoriesStore.getState().activateTab(spaceId, codeTabId("/a"));
    syncModeFromTab();
    expect(useUiModeStore.getState().uiMode).toBe("editor");

    useOpenRepositoriesStore.getState().activateTab(spaceId, firstTabId("/a"));
    syncModeFromTab();
    expect(useUiModeStore.getState().uiMode).toBe("agents");
  });

  it("opens the matching tab when code switches the mode", () => {
    syncTabFromMode("editor");
    expect(activeTabId()).toBe(codeTabId("/a"));
    syncTabFromMode("agents");
    expect(activeTabId()).toBe(firstTabId("/a"));
  });

  it("keeps the active agents tab when the mode is already agents", () => {
    const spaceId = useOpenRepositoriesStore.getState().spaces[0].id;
    const second = useOpenRepositoriesStore.getState().addTab(spaceId, "Agents 2");
    syncTabFromMode("agents");
    expect(activeTabId()).toBe(second);
  });

  it("leaves the mode alone without an open space", () => {
    useOpenRepositoriesStore.getState().clear();
    useUiModeStore.setState({ uiMode: "agents" });
    syncModeFromTab();
    expect(useUiModeStore.getState().uiMode).toBe("agents");
  });
});
