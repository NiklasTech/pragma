import { beforeEach, describe, expect, it } from "vite-plus/test";

import { HISTORY_TAB_ID, useEditorStore } from "@/shared/stores/editor";

import { openGitHistory } from "./openGitHistory";

describe("openGitHistory", () => {
  beforeEach(() => {
    useEditorStore.setState({
      tabs: [],
      tabStates: [],
      activeTabId: null,
      activeTabIds: {},
      lastFocusedPanelId: "panel-1",
    });
  });

  it("opens the history as a tab in the editor used last", () => {
    openGitHistory();
    const state = useEditorStore.getState();
    expect(state.tabs.map((tab) => tab.kind)).toEqual(["history"]);
    expect(state.activeTabIds["panel-1"]).toBe(HISTORY_TAB_ID);
  });

  it("keeps one history tab and brings it back to the front", () => {
    openGitHistory();
    useEditorStore.setState({ activeTabId: null, activeTabIds: { "panel-1": null } });
    openGitHistory();
    const state = useEditorStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabIds["panel-1"]).toBe(HISTORY_TAB_ID);
  });
});
