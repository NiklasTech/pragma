import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  countLeaves,
  findLeaf,
  findLeafBySession,
  type PaneNode,
  type PaneRoot,
} from "./operations";
import { useAgentsPanesStore } from "./store";

const ROOT = "/workspace";

function sessionsInOrder(root: PaneRoot): Array<string | null> {
  if (!root) return [];
  if (root.type === "tabs") return root.children.map((leaf) => leaf.sessionId);
  return root.children.flatMap((child: PaneNode) => sessionsInOrder(child));
}

function entry() {
  return useAgentsPanesStore.getState().trees[ROOT];
}

describe("agents panes store", () => {
  beforeEach(() => {
    useAgentsPanesStore.setState({ trees: {} });
  });

  it("opens sessions as tabs in the focused group", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "a");
    store.openSession(ROOT, "b");

    expect(countLeaves(entry().root)).toBe(2);
    expect(findLeafBySession(entry().root, "b")).not.toBeNull();
  });

  it("keeps the session when a pane closes", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "a");
    const leafId = findLeaf(entry().root, entry().focusedLeafId ?? "")?.id ?? "";
    store.closeLeaf(ROOT, leafId);

    expect(entry().root).toBeNull();
    expect(entry().focusedLeafId).toBeNull();
  });

  it("drops leaves whose session is gone", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "a");
    store.openSession(ROOT, "b");
    store.syncSessions(ROOT, ["b"]);

    expect(countLeaves(entry().root)).toBe(1);
    expect(findLeafBySession(entry().root, "a")).toBeNull();
  });

  it("fills the grid from the most recently focused sessions", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "a");
    store.openSession(ROOT, "b");
    store.openSession(ROOT, "c");
    store.applyPreset(ROOT, "grid", ["a", "b", "c"]);

    expect(sessionsInOrder(entry().root)).toEqual(["c", "b", "a", null]);
  });

  it("swaps the tree when the folder changes", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession("/one", "a");
    store.openSession("/two", "b");

    expect(
      findLeafBySession(useAgentsPanesStore.getState().trees["/one"].root, "a"),
    ).not.toBeNull();
    expect(
      findLeafBySession(useAgentsPanesStore.getState().trees["/two"].root, "b"),
    ).not.toBeNull();
  });
});
