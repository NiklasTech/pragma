import { describe, expect, it } from "vite-plus/test";

import {
  assignLeafSession,
  countLeaves,
  createBrowserLeaf,
  createLeaf,
  createSplit,
  createTabs,
  distributeSizes,
  findBrowserLeaf,
  findLeaf,
  updateSplitSizes,
  type Leaf,
  type PaneNode,
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

  it("counts leaves across groups and splits", () => {
    const root = split(
      "horizontal",
      [tabs([leaf("a", "a"), leaf("b", "b")], "t1"), tabs([leaf("c", "c")], "t2")],
      "sp1",
    );

    expect(countLeaves(root)).toBe(3);
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

    expect(countLeaves(next)).toBe(2);
    expect(findLeaf(next, "empty")?.sessionId).toBe("b");
    expect(findLeaf(next, "a")?.sessionId).toBe("a");
  });

  it("turns a browser leaf into a session leaf", () => {
    const root = tabs([createBrowserLeaf("browser")], "t1");
    const next = assignLeafSession(root, "browser", "s1");

    expect(findBrowserLeaf(next)).toBeNull();
    expect(findLeaf(next, "browser")?.sessionId).toBe("s1");
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
