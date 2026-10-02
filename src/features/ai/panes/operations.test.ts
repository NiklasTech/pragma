import { describe, expect, it } from "vite-plus/test";

import {
  MAX_PANES,
  addLeafRight,
  closeLeaf,
  countLeaves,
  createBrowserLeaf,
  createLeaf,
  createSplit,
  createTabs,
  distributeSizes,
  dockAsTab,
  dropMissingSessions,
  findBrowserLeaf,
  findLeaf,
  focusLeaf,
  focusPreset,
  gridPreset,
  assignLeafSession,
  pairPreset,
  setActiveTab,
  splitFocused,
  splitToward,
  updateSplitSizes,
  type Leaf,
  type PaneNode,
  type PaneRoot,
  type SplitNode,
  type TabsNode,
} from "./operations";

function leaf(sessionId: string | null, id: string): Leaf {
  return createLeaf(sessionId, id);
}

function tabs(children: Leaf[], id: string, activeLeafId = children[0].id): TabsNode {
  return createTabs(children, activeLeafId, id);
}

function split(
  direction: SplitNode["direction"],
  children: PaneNode[],
  id: string,
  sizes?: number[],
): SplitNode {
  return createSplit(direction, children, sizes, id);
}

function fullTree(): PaneRoot {
  const leaves = Array.from({ length: MAX_PANES }, (_, index) =>
    leaf(`s${index}`, `leaf-${index}`),
  );
  return tabs(leaves, "tabs-full");
}

describe("distributeSizes", () => {
  it("sums to exactly 100", () => {
    for (const count of [1, 2, 3, 4, 7]) {
      const sizes = distributeSizes(count);
      expect(sizes).toHaveLength(count);
      expect(sizes.reduce((total, size) => total + size, 0)).toBe(100);
    }
  });
});

describe("countLeaves", () => {
  it("is zero for home", () => {
    expect(countLeaves(null)).toBe(0);
  });

  it("counts leaves across tabs and splits", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a"), leaf("b", "b")], "t1"), tabs([leaf("c", "c")], "t2")],
      "sp1",
    );

    expect(countLeaves(root)).toBe(3);
  });
});

describe("splitFocused", () => {
  it("opens an empty pane beside the focused session", () => {
    const root = tabs([leaf("a", "a")], "t1");
    const result = splitFocused(root, "a", "horizontal");
    const sessions =
      result.root?.type === "split"
        ? result.root.children.flatMap((child) =>
            child.type === "tabs" ? child.children.map((item) => item.sessionId) : [],
          )
        : [];

    expect(result.root?.type).toBe("split");
    expect(countLeaves(result.root)).toBe(2);
    expect(sessions).toEqual(["a", null]);
    expect(result.focusedLeafId).toBe("a");
  });

  it("uses a vertical split when splitting down", () => {
    const root = tabs([leaf("a", "a")], "t1");
    const result = splitFocused(root, "a", "vertical");

    expect(result.root?.type === "split" ? result.root.direction : null).toBe("vertical");
  });

  it("copies a null session for an empty pane", () => {
    const root = tabs([leaf(null, "empty")], "t1");
    const result = splitFocused(root, "empty", "horizontal");
    const newLeaf = result.focusedLeafId ? findLeaf(result.root, result.focusedLeafId) : null;

    expect(newLeaf?.sessionId).toBeNull();
  });

  it("refuses at the cap", () => {
    const root = fullTree();
    const result = splitFocused(root, "leaf-0", "horizontal");

    expect(result.root).toBe(root);
  });
});

describe("closeLeaf", () => {
  it("removes only the requested leaf", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b")], "t1", "a");
    const result = closeLeaf(root, "a", "a");

    expect(root.type === "tabs" ? countLeaves(result.root) : 0).toBe(1);
    expect(findLeaf(result.root, "a")).toBeNull();
    expect(findLeaf(result.root, "b")).not.toBeNull();
  });

  it("collapses a group that becomes empty", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    const result = closeLeaf(root, "a", "a");

    expect(result.root?.type).toBe("tabs");
    expect(countLeaves(result.root)).toBe(1);
  });

  it("returns null after the last leaf closes", () => {
    const root = tabs([leaf("a", "a")], "t1");
    const result = closeLeaf(root, "a", "a");

    expect(result.root).toBeNull();
    expect(result.focusedLeafId).toBeNull();
  });

  it("keeps the focused leaf when a different leaf closes", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b")], "t1", "a");
    const result = closeLeaf(root, "a", "b");

    expect(result.focusedLeafId).toBe("a");
  });
});

describe("focus and tabs", () => {
  it("focusLeaf updates the active tab in the group", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b")], "t1", "a");
    const next = focusLeaf(root, "b");

    expect(next?.type === "tabs" ? next.activeLeafId : null).toBe("b");
  });

  it("setActiveTab ignores unknown leaves", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b")], "t1", "a");
    expect(setActiveTab(root, "t1", "missing")).toBe(root);
  });
});

describe("presets", () => {
  it("focus builds a single pane", () => {
    const root = focusPreset(["a"]);

    expect(root.type).toBe("tabs");
    expect(countLeaves(root)).toBe(1);
    expect(root.children[0].sessionId).toBe("a");
  });

  it("pair builds two equal columns", () => {
    const root = pairPreset(["a", "b"]);

    expect(root.direction).toBe("horizontal");
    expect(root.sizes).toEqual([50, 50]);
    expect(root.children.every((child) => child.type === "tabs")).toBe(true);
  });

  it("grid builds two by two and fills missing slots with null", () => {
    const root = gridPreset(["a", "b"]);
    const sessions = [root.children[0], root.children[1]].map((node) =>
      node.type === "split"
        ? node.children.map((group) => (group.type === "tabs" ? group.children[0].sessionId : null))
        : [],
    );

    expect(root.direction).toBe("vertical");
    expect(root.sizes).toEqual([50, 50]);
    expect(sessions).toEqual([
      ["a", "b"],
      [null, null],
    ]);
  });
});

describe("drag operations", () => {
  function tabIds(root: PaneRoot): string[] {
    return root?.type === "tabs" ? root.children.map((child) => child.id) : [];
  }

  it("docks a leaf as a tab in the target group", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    const next = dockAsTab(root, "b", "t1");

    expect(next?.type).toBe("tabs");
    expect(countLeaves(next)).toBe(2);
    expect(next?.type === "tabs" ? next.activeLeafId : null).toBe("b");
  });

  it("docks a leaf at the dropped tab position", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a"), leaf("c", "c")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    expect(tabIds(dockAsTab(root, "b", "t1", 1))).toEqual(["a", "b", "c"]);
    expect(tabIds(dockAsTab(root, "b", "t1", 0))).toEqual(["b", "a", "c"]);
  });

  it("reorders tabs within the same group", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b"), leaf("c", "c")], "t1");

    expect(tabIds(dockAsTab(root, "a", "t1", 3))).toEqual(["b", "c", "a"]);
    expect(tabIds(dockAsTab(root, "c", "t1", 0))).toEqual(["c", "a", "b"]);
    expect(tabIds(dockAsTab(root, "a", "t1", 2))).toEqual(["b", "a", "c"]);
    expect(dockAsTab(root, "b", "t1", 1)).toBe(root);
    expect(dockAsTab(root, "b", "t1", 2)).toBe(root);
  });

  it("splits toward the dropped edge", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    const next = splitToward(root, "b", "t1", "right");

    expect(next?.type).toBe("split");
    if (next?.type === "split") {
      expect(next.direction).toBe("horizontal");
      expect(next.children[1].type === "tabs" ? next.children[1].children[0].sessionId : null).toBe(
        "b",
      );
    }
  });

  it("splits a tab out of its own group", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b")], "t1");
    const next = splitToward(root, "b", "t1", "bottom");

    expect(next?.type).toBe("split");
    if (next?.type === "split") {
      expect(next.direction).toBe("vertical");
      expect(tabIds(next.children[0])).toEqual(["a"]);
      expect(tabIds(next.children[1])).toEqual(["b"]);
    }
  });

  it("ignores splitting a single tab beside itself", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    expect(splitToward(root, "a", "t1", "right")).toBe(root);
  });

  it("moves a leaf at the cap because the pane count stays the same", () => {
    const root = fullTree();
    const next = splitToward(root, "leaf-0", "tabs-full", "left");

    expect(countLeaves(next)).toBe(MAX_PANES);
    expect(next?.type === "split" ? tabIds(next.children[0]) : []).toEqual(["leaf-0"]);
  });
});

describe("dropMissingSessions", () => {
  it("drops leaves whose session no longer exists", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b")], "t1", "a");
    const next = dropMissingSessions(root, ["a"]);

    expect(next?.type).toBe("tabs");
    expect(countLeaves(next)).toBe(1);
    expect(findLeaf(next, "b")).toBeNull();
  });

  it("keeps empty leaves", () => {
    const root = tabs([leaf(null, "empty")], "t1");
    expect(dropMissingSessions(root, [])).toBe(root);
  });

  it("returns null when every session leaf is gone", () => {
    const root = tabs([leaf("a", "a")], "t1");
    expect(dropMissingSessions(root, [])).toBeNull();
  });
});

describe("assignLeafSession", () => {
  it("fills an empty slot without opening a second pane", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf(null, "empty")], "t2")],
      "pair",
    );

    const next = assignLeafSession(root, "empty", "b");
    const slot = findLeaf(next, "empty");

    expect(countLeaves(next)).toBe(2);
    expect(slot?.sessionId).toBe("b");
    expect(findLeaf(next, "a")?.sessionId).toBe("a");
  });
});

describe("updateSplitSizes", () => {
  it("updates a nested split", () => {
    const root = split(
      "vertical",
      [
        split("horizontal", [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")], "inner"),
        tabs([leaf("c", "c")], "t3"),
      ],
      "outer",
    );
    const next = updateSplitSizes(root, "inner", [30, 70]);

    const inner = next?.type === "split" ? next.children[0] : null;
    expect(inner?.type === "split" ? inner.sizes : null).toEqual([30, 70]);
  });

  it("keeps the same tree when the sizes did not change", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
      [40, 60],
    );

    expect(updateSplitSizes(root, "sp1", [40.001, 59.999])).toBe(root);
  });
});

describe("browser leaves", () => {
  it("adds a leaf right of the focused pane, or as the first pane", () => {
    const browser = createBrowserLeaf("browser");
    const first = addLeafRight(null, null, browser);
    expect(first?.type).toBe("tabs");
    expect(findBrowserLeaf(first)?.id).toBe("browser");

    const root = tabs([leaf("a", "a")], "t1");
    const next = addLeafRight(root, "a", browser);
    expect(next?.type).toBe("split");
    expect(findBrowserLeaf(next)?.id).toBe("browser");
    expect(addLeafRight(fullTree(), "leaf-0", browser)).toEqual(fullTree());
  });

  it("stays a browser leaf when dragged into a split", () => {
    const root = tabs([leaf("a", "a"), createBrowserLeaf("browser")], "t1");
    const next = splitToward(root, "browser", "t1", "right");
    expect(findBrowserLeaf(next)?.id).toBe("browser");
  });

  it("stops being a browser leaf when a session is assigned", () => {
    const root = tabs([createBrowserLeaf("browser")], "t1");
    const next = assignLeafSession(root, "browser", "s1");
    expect(findBrowserLeaf(next)).toBeNull();
    expect(findLeaf(next, "browser")?.sessionId).toBe("s1");
  });

  it("survives dropping missing sessions", () => {
    const root = tabs([leaf("a", "a"), createBrowserLeaf("browser")], "t1");
    expect(findBrowserLeaf(dropMissingSessions(root, []))?.id).toBe("browser");
  });
});
