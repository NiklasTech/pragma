import { describe, expect, it } from "vite-plus/test";

import { arrangeLeaves, buildLayout, collectLeaves, gridRowCounts } from "./layout";
import { createLeaf, createSplit, createTabs, type PaneRoot } from "./operations";

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
    expect(gridRowCounts(8)).toEqual([4, 4]);
  });

  it("returns no rows for zero panes", () => {
    expect(gridRowCounts(0)).toEqual([]);
  });
});

describe("buildLayout", () => {
  it("builds a single group for one leaf", () => {
    expect(shape(buildLayout(leaves(1), "grid"))).toEqual(["s0"]);
  });

  it("tiles eight leaves as a four by two grid", () => {
    expect(shape(buildLayout(leaves(8), "grid"))).toEqual({
      vertical: [
        { horizontal: [["s0"], ["s1"], ["s2"], ["s3"]] },
        { horizontal: [["s4"], ["s5"], ["s6"], ["s7"]] },
      ],
    });
  });

  it("lines leaves up as columns or rows", () => {
    expect(shape(buildLayout(leaves(3), "columns"))).toEqual({
      horizontal: [["s0"], ["s1"], ["s2"]],
    });
    expect(shape(buildLayout(leaves(3), "rows"))).toEqual({
      vertical: [["s0"], ["s1"], ["s2"]],
    });
  });

  it("returns null without leaves", () => {
    expect(buildLayout([], "grid")).toBeNull();
  });
});

describe("arrangeLeaves", () => {
  it("splits tab groups into separate panes and keeps leaf ids", () => {
    const [a, b, c] = leaves(3);
    const root = createSplit("vertical", [createTabs([a, b], a.id), createTabs([c], c.id)]);

    const arranged = arrangeLeaves(root, "columns");

    expect(shape(arranged)).toEqual({ horizontal: [["s0"], ["s1"], ["s2"]] });
    expect(collectLeaves(arranged).map((leaf) => leaf.id)).toEqual([a.id, b.id, c.id]);
  });
});
