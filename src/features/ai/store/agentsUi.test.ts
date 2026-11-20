import { describe, expect, it } from "vite-plus/test";

import { useAgentsUiStore } from "./agentsUi";

describe("agents ui store", () => {
  it("starts with the thread list as a closed drawer", () => {
    expect(useAgentsUiStore.getState().threadsPinned).toBe(false);
    expect(useAgentsUiStore.getState().threadsOpen).toBe(false);
  });

  it("opens the thread list when it is pinned and toggles it", () => {
    useAgentsUiStore.getState().setThreadsPinned(true);
    expect(useAgentsUiStore.getState().threadsOpen).toBe(true);

    useAgentsUiStore.getState().toggleThreads();
    expect(useAgentsUiStore.getState().threadsOpen).toBe(false);
    useAgentsUiStore.setState({ threadsPinned: false, threadsOpen: false });
  });
});
