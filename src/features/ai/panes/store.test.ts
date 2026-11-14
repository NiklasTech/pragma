import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  countLeaves,
  findLeaf,
  findLeafBySession,
  type PaneNode,
  type PaneRoot,
} from "./operations";
import { migratePaneTrees, paneTreeKey, selectRoot, useAgentsPanesStore } from "./store";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { firstTabId } from "@/shared/stores/spaces/model";

const ROOT = "/workspace";

function sessionsInOrder(root: PaneRoot): Array<string | null> {
  if (!root) return [];
  if (root.type === "tabs") return root.children.map((leaf) => leaf.sessionId);
  return root.children.flatMap((child: PaneNode) => sessionsInOrder(child));
}

function entry() {
  return useAgentsPanesStore.getState().trees[firstTabId(ROOT)];
}

describe("agents panes store", () => {
  beforeEach(() => {
    useAgentsPanesStore.setState({ trees: {} });
  });

  it("opens each session in its own pane", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "a");
    store.openSession(ROOT, "b");

    expect(countLeaves(entry().root)).toBe(2);
    expect(entry().root?.type).toBe("split");
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

  it("swaps two panes and focuses the dragged one", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "a");
    store.openSession(ROOT, "b");
    const a = findLeafBySession(entry().root, "a")?.id ?? "";
    const b = findLeafBySession(entry().root, "b")?.id ?? "";
    store.swapPanes(ROOT, a, b);

    expect(sessionsInOrder(entry().root)).toEqual(["b", "a"]);
    expect(entry().focusedLeafId).toBe(a);
  });

  it("refuses a new session at the cap", () => {
    const store = useAgentsPanesStore.getState();
    for (let index = 0; index < 9; index += 1) store.openSession(ROOT, `s${index}`);

    expect(countLeaves(entry().root)).toBe(8);
    expect(findLeafBySession(entry().root, "s8")).toBeNull();
  });

  it("re-tiles the grid when a pane closes", () => {
    const store = useAgentsPanesStore.getState();
    for (const id of ["a", "b", "c", "d"]) store.openSession(ROOT, id);
    store.closeLeaf(ROOT, findLeafBySession(entry().root, "b")?.id ?? "");

    expect(entry().root?.id).toBe("row-0");
    expect(sessionsInOrder(entry().root)).toEqual(["a", "c", "d"]);
  });

  it("replaces the layout with the launched sessions", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession(ROOT, "old");
    store.replaceLayout(ROOT, ["a", "b", "c", "d"]);

    expect(sessionsInOrder(entry().root)).toEqual(["a", "b", "c", "d"]);
    expect(findLeaf(entry().root, entry().focusedLeafId ?? "")?.sessionId).toBe("a");
    expect(entry().focusOrder).toEqual(["a", "b", "c", "d", "old"]);
  });

  it("swaps the tree when the folder changes", () => {
    const store = useAgentsPanesStore.getState();
    store.openSession("/one", "a");
    store.openSession("/two", "b");

    expect(
      findLeafBySession(useAgentsPanesStore.getState().trees[firstTabId("/one")].root, "a"),
    ).not.toBeNull();
    expect(
      findLeafBySession(useAgentsPanesStore.getState().trees[firstTabId("/two")].root, "b"),
    ).not.toBeNull();
  });
});

describe("pane layouts per tab", () => {
  beforeEach(() => {
    useAgentsPanesStore.setState({ trees: {} });
    useOpenRepositoriesStore.getState().clear();
    useOpenRepositoriesStore.getState().add(ROOT);
  });

  it("keeps a separate layout for each tab of a space", () => {
    const panes = useAgentsPanesStore.getState();
    panes.openSession(ROOT, "a");

    const spaceId = useOpenRepositoriesStore.getState().spaces[0].id;
    const review = useOpenRepositoriesStore.getState().addTab(spaceId, "Review") ?? "";
    expect(paneTreeKey(ROOT)).toBe(review);
    expect(selectRoot(useAgentsPanesStore.getState(), review)).toBeNull();

    panes.openSession(ROOT, "b");
    useOpenRepositoriesStore.getState().activateTab(spaceId, firstTabId(ROOT));

    const state = useAgentsPanesStore.getState();
    expect(sessionsInOrder(selectRoot(state, firstTabId(ROOT)))).toEqual(["a"]);
    expect(sessionsInOrder(selectRoot(state, review))).toEqual(["b"]);
  });

  it("moves layouts stored per folder to the folder's first tab", () => {
    const layout = { root: null, focusedLeafId: null, focusOrder: ["a"] };

    const migrated = migratePaneTrees({ trees: { [ROOT]: layout } }, 1);

    expect(migrated.trees).toEqual({ [firstTabId(ROOT)]: layout });
  });
});
