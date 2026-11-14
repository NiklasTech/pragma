import { describe, expect, it } from "vite-plus/test";

import {
  CONTEXT_PANE_DEFAULT_WIDTH,
  CONTEXT_PANE_MAX_WIDTH,
  CONTEXT_PANE_MIN_WIDTH,
  shouldAutoOpenContextPane,
  useAgentsUiStore,
} from "./agentsUi";

describe("agents ui store", () => {
  it("starts with the context pane collapsed at the default width", () => {
    expect(useAgentsUiStore.getState().contextPaneCollapsed).toBe(true);
    expect(useAgentsUiStore.getState().contextPaneWidth).toBe(CONTEXT_PANE_DEFAULT_WIDTH);
  });

  it("clamps the context pane width", () => {
    useAgentsUiStore.getState().setContextPaneWidth(10);
    expect(useAgentsUiStore.getState().contextPaneWidth).toBe(CONTEXT_PANE_MIN_WIDTH);

    useAgentsUiStore.getState().setContextPaneWidth(9999);
    expect(useAgentsUiStore.getState().contextPaneWidth).toBe(CONTEXT_PANE_MAX_WIDTH);
  });

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

describe("shouldAutoOpenContextPane", () => {
  it("stays closed on a quiet home", () => {
    expect(
      shouldAutoOpenContextPane({ status: "idle", editReviewCount: 0, checkpointedCount: 0 }),
    ).toBe(false);
  });

  it("opens while waiting for approval", () => {
    expect(
      shouldAutoOpenContextPane({
        status: "waiting-approval",
        editReviewCount: 0,
        checkpointedCount: 0,
      }),
    ).toBe(true);
  });

  it("opens when reviews or changed files exist", () => {
    expect(
      shouldAutoOpenContextPane({ status: "running", editReviewCount: 1, checkpointedCount: 0 }),
    ).toBe(true);
    expect(
      shouldAutoOpenContextPane({ status: "running", editReviewCount: 0, checkpointedCount: 2 }),
    ).toBe(true);
  });
});
