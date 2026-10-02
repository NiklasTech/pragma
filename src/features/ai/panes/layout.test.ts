import { describe, expect, it } from "vite-plus/test";

import { autoLayout, collectLeaves, gridRowCounts, swapLeaves } from "./layout";
import { createLeaf, createSplit, createTabs, updateSplitSizes, type PaneRoot } from "./operations";

function leaves(count: number) {
  return Array.from({ length: count }, (_, index) => createLeaf(`s${index}`, `leaf-${index}`));
}

function shape(root: PaneRoot): unknown {
  if (!root) return null;
  if (root.type === "tabs") return root.children.map((leaf) => leaf.sessionId);
  return { [root.direction]: root.children.map((child) => shape(child)) };
}

describe("gridRowCounts", () => {
  it("prefers wide grids", () => {
    expect(gridRowCounts(1)).toEqual([1]);
    expect(gridRowCounts(2)).toEqual([2]);
    expect(gridRowCounts(3)).toEqual([3]);
    expect(gridRowCounts(4)).toEqual([2, 2]);
    expect(gridRowCounts(5)).toEqual([3, 2]);
    expect(gridRowCounts(6)).toEqual([3, 3]);
    expect(gridRowCounts(8)).toEqual([4, 4]);
  });

  it("returns no rows for zero panes", () => {
    expect(gridRowCounts(0)).toEqual([]);
  });
});

describe("autoLayout", () => {
  it("builds a single pane for one leaf", () => {
    expect(shape(autoLayout(leaves(1)))).toEqual(["s0"]);
  });

  it("puts five panes as three on top and two below", () => {
    expect(shape(autoLayout(leaves(5)))).toEqual({
      vertical: [{ horizontal: [["s0"], ["s1"], ["s2"]] }, { horizontal: [["s3"], ["s4"]] }],
    });
  });

  it("tiles eight leaves as a four by two grid", () => {
    expect(shape(autoLayout(leaves(8)))).toEqual({
      vertical: [
        { horizontal: [["s0"], ["s1"], ["s2"], ["s3"]] },
        { horizontal: [["s4"], ["s5"], ["s6"], ["s7"]] },
      ],
    });
  });

  it("gives every leaf its own pane and keeps leaf ids", () => {
    const [a, b, c] = leaves(3);
    const root = createSplit("vertical", [createTabs([a, b], a.id), createTabs([c], c.id)]);
    const arranged = autoLayout(collectLeaves(root));

    expect(shape(arranged)).toEqual({ horizontal: [["s0"], ["s1"], ["s2"]] });
    expect(collectLeaves(arranged).map((leaf) => leaf.id)).toEqual([a.id, b.id, c.id]);
  });

  it("uses stable ids and keeps sizes while the shape stays the same", () => {
    const first = autoLayout(leaves(2));
    const resized = updateSplitSizes(first, "row-0", [30, 70]);
    const again = autoLayout(collectLeaves(resized), resized);

    expect(again?.id).toBe("row-0");
    expect(again?.type === "split" && again.sizes).toEqual([30, 70]);
    const three = autoLayout(leaves(3), resized);
    expect(three?.type === "split" && three.sizes.map(Math.round)).toEqual([33, 33, 33]);
  });

  it("returns null without leaves", () => {
    expect(autoLayout([])).toBeNull();
  });
});

describe("swapLeaves", () => {
  it("exchanges two panes and keeps the grid", () => {
    const root = autoLayout(leaves(5));
    const swapped = swapLeaves(root, "leaf-0", "leaf-4");

    expect(shape(swapped)).toEqual({
      vertical: [{ horizontal: [["s4"], ["s1"], ["s2"]] }, { horizontal: [["s3"], ["s0"]] }],
    });
  });

  it("ignores unknown or identical leaves", () => {
    const root = autoLayout(leaves(2));

    expect(swapLeaves(root, "leaf-0", "leaf-0")).toBe(root);
    expect(swapLeaves(root, "leaf-0", "missing")).toBe(root);
  });
});
