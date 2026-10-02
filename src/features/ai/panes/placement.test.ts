import { describe, expect, it } from "vite-plus/test";

import {
  MAX_PANES,
  countLeaves,
  createLeaf,
  createSplit,
  createTabs,
  findLeaf,
  findLeafBySession,
  type Leaf,
  type PaneNode,
  type PaneRoot,
  type SplitNode,
  type TabsNode,
} from "./operations";
import { openSession, placeBeside } from "./placement";

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

function groups(root: PaneRoot): TabsNode[] {
  if (!root) return [];
  if (root.type === "tabs") return [root];
  return root.children.flatMap((child) => groups(child));
}

describe("openSession", () => {
  it("turns a null root into one pane and focuses the leaf", () => {
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

  it("opens a second session in its own pane instead of a tab", () => {
    const root = tabs([leaf("a", "a")], "t1");
    const result = openSession(root, "a", "b");

    expect(result.root?.type).toBe("split");
    expect(groups(result.root).map((group) => group.children.length)).toEqual([1, 1]);
    expect(result.focusedLeafId).toBe(findLeafBySession(result.root, "b")?.id ?? null);
  });

  it("splits a wide area into columns and a tall area into rows", () => {
    const wide = openSession(tabs([leaf("a", "a")], "t1"), "a", "b", 1.6).root;
    const tall = openSession(tabs([leaf("a", "a")], "t1"), "a", "b", 0.6).root;

    expect(wide?.type === "split" && wide.direction).toBe("horizontal");
    expect(tall?.type === "split" && tall.direction).toBe("vertical");
  });

  it("keeps every pane in its own group up to the cap", () => {
    let root: PaneRoot = null;
    let focused: string | null = null;
    for (let index = 0; index < MAX_PANES; index += 1) {
      const result = openSession(root, focused, `s${index}`, 1.4);
      root = result.root;
      focused = result.focusedLeafId;
    }

    expect(countLeaves(root)).toBe(MAX_PANES);
    expect(groups(root)).toHaveLength(MAX_PANES);
  });

  it("refuses a new session at the cap", () => {
    const leaves = Array.from({ length: MAX_PANES }, (_, index) =>
      leaf(`s${index}`, `leaf-${index}`),
    );
    const root = tabs(leaves, "tabs-full");
    const result = openSession(root, "leaf-0", "extra");

    expect(result.root).toBe(root);
    expect(countLeaves(result.root)).toBe(MAX_PANES);
  });
});

describe("placeBeside", () => {
  it("joins a parent split instead of halving the focused pane", () => {
    const root = split(
      "horizontal",
      [
        tabs([leaf("a", "a")], "t1"),
        split("vertical", [tabs([leaf("b", "b")], "t2"), tabs([leaf("c", "c")], "t3")], "sp2"),
      ],
      "sp1",
    );
    const next = placeBeside(root, "t3", tabs([leaf("d", "d")], "t4"), 1.4);

    expect(next.type === "split" && next.children.length).toBe(3);
    expect(next.type === "split" && next.sizes).toHaveLength(3);
  });
});
