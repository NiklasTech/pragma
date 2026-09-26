import { describe, expect, it } from "vite-plus/test";

import {
  MAX_PANES,
  closeLeaf,
  countLeaves,
  createLeaf,
  createSplit,
  createTabs,
  distributeSizes,
  dockAsTab,
  dropMissingSessions,
  findLeaf,
  findLeafBySession,
  focusLeaf,
  focusPreset,
  gridPreset,
  assignLeafSession,
  openSession,
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

describe("openSession", () => {
  it("turns a null root into one tab and focuses the leaf", () => {
    const result = openSession(null, null, "a");

    expect(result.root?.type).toBe("tabs");
    expect(countLeaves(result.root)).toBe(1);
    expect(result.focusedLeafId).toBe(findLeafBySession(result.root, "a")?.id ?? null);
  });

  it("focuses an already open session without adding a leaf", () => {
    const root = tabs([leaf("a", "a"), leaf("b", "b")], "t1", "a");
    const result = openSession(root, "a", "b");

    expect(countLeaves(result.root)).toBe(2);
    expect(result.focusedLeafId).toBe("b");
    expect(findLeaf(result.root, "b")).not.toBeNull();
  });

  it("adds a tab to the focused group", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    const result = openSession(root, "b", "c");

    const group = result.root?.type === "split" ? result.root.children[1] : null;
    expect(group?.type).toBe("tabs");
    expect(countLeaves(result.root)).toBe(3);
    expect(result.focusedLeafId).toBe(findLeafBySession(result.root, "c")?.id ?? null);
  });

  it("refuses a new session at the cap", () => {
    const root = fullTree();
    const result = openSession(root, "leaf-0", "extra");

    expect(result.root).toBe(root);
    expect(countLeaves(result.root)).toBe(MAX_PANES);
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
  it("docks a leaf as a tab in the target group", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    const next = dockAsTab(root, "b", "a");

    expect(next?.type).toBe("tabs");
    expect(countLeaves(next)).toBe(2);
    expect(next?.type === "tabs" ? next.activeLeafId : null).toBe("b");
  });

  it("splits toward the dropped edge", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a")], "t1"), tabs([leaf("b", "b")], "t2")],
      "sp1",
    );
    const next = splitToward(root, "b", "a", "right");

    expect(next?.type).toBe("split");
    if (next?.type === "split") {
      expect(next.direction).toBe("horizontal");
      expect(next.children[1].type === "tabs" ? next.children[1].children[0].sessionId : null).toBe(
        "b",
      );
    }
  });

  it("refuses an edge split at the cap", () => {
    const root = fullTree();
    const next = splitToward(root, "leaf-0", "leaf-1", "left");

    expect(next).toBe(root);
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
});
