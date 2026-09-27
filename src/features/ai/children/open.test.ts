import { beforeEach, describe, expect, it } from "vite-plus/test";

import { countLeaves, findLeaf, findLeafBySession, MAX_PANES } from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";

import { showSessionInPane } from "./open";

const ROOT = "/workspace";

function entry() {
  return useAgentsPanesStore.getState().trees[ROOT];
}

function focusedSession(): string | null {
  const current = entry();
  return current.focusedLeafId
    ? (findLeaf(current.root, current.focusedLeafId)?.sessionId ?? null)
    : null;
}

describe("showSessionInPane", () => {
  beforeEach(() => {
    useAgentsPanesStore.setState({ trees: {} });
  });

  it("focuses a session that already has a pane", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "child");
    store.openSession(ROOT, "parent");

    showSessionInPane(ROOT, "child");

    expect(countLeaves(entry().root)).toBe(2);
    expect(focusedSession()).toBe("child");
  });

  it("splits right when under the pane cap", () => {
    useAgentsPanesStore.getState().openSession(ROOT, "parent");

    showSessionInPane(ROOT, "child");

    expect(entry().root?.type).toBe("split");
    expect(findLeafBySession(entry().root, "parent")).not.toBeNull();
    expect(focusedSession()).toBe("child");
  });

  it("uses the focused pane at the pane cap", () => {
    const store = useAgentsPanesStore.getState();
    for (let index = 0; index < MAX_PANES; index++) store.openSession(ROOT, `s${index}`);

    showSessionInPane(ROOT, "child");

    expect(countLeaves(entry().root)).toBe(MAX_PANES);
    expect(focusedSession()).toBe("child");
  });
});
