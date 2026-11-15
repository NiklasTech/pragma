import { describe, expect, it } from "vite-plus/test";

import { collectLeaves } from "./layout";
import { createLeaf, createSplit, createTabs, type PaneNode, type PaneRoot } from "./operations";
import { nextSplitDirection, removeLeaf, splitBeside, swapInPlace } from "./split";

const group = (id: string) => createTabs([createLeaf(`s-${id}`, id)], id, `group-${id}`);

function shape(node: PaneRoot): unknown {
  if (!node) return null;
  if (node.type === "tabs") return node.children.map((leaf) => leaf.id).join(",");
  return { [node.direction === "horizontal" ? "row" : "col"]: node.children.map(shape) };
}

describe("splitBeside", () => {
  it("turns a single pane into a split", () => {
    const root = splitBeside(group("a"), "a", createLeaf(null, "b"), "horizontal");
    expect(shape(root)).toEqual({ row: ["a", "b"] });
  });

  it("joins a split of the same direction and halves the target's share", () => {
    const row = createSplit("horizontal", [group("a"), group("b")], [60, 40], "row");
    const root = splitBeside(row, "a", createLeaf(null, "c"), "horizontal");
    expect(shape(root)).toEqual({ row: ["a", "c", "b"] });
    expect(root?.type === "split" && root.sizes).toEqual([30, 30, 40]);
  });

  it("nests across the direction of the parent", () => {
    const row = createSplit("horizontal", [group("a"), group("b")], undefined, "row");
    const root = splitBeside(row, "b", createLeaf(null, "c"), "vertical");
    expect(shape(root)).toEqual({ row: ["a", { col: ["b", "c"] }] });
  });
});

describe("removeLeaf", () => {
  it("collapses a split that keeps one pane and rescales the rest", () => {
    const col = createSplit("vertical", [group("b"), group("c")], undefined, "col");
    const row: PaneNode = createSplit("horizontal", [group("a"), col, group("d")], [50, 30, 20]);
    const withoutC = removeLeaf(row, "c");
    expect(shape(withoutC)).toEqual({ row: ["a", "b", "d"] });
    const withoutA = removeLeaf(withoutC, "a");
    expect(withoutA?.type === "split" && withoutA.sizes).toEqual([60, 40]);
  });

  it("empties the tree when the last pane goes", () => {
    expect(removeLeaf(group("a"), "a")).toBeNull();
  });
});

describe("swapInPlace", () => {
  it("exchanges two panes and keeps the splits", () => {
    const col = createSplit("vertical", [group("b"), group("c")], undefined, "col");
    const row = createSplit("horizontal", [group("a"), col], [70, 30], "row");
    const swapped = swapInPlace(row, "a", "c");
    expect(shape(swapped)).toEqual({ row: ["c", { col: ["b", "a"] }] });
    expect(collectLeaves(swapped)).toHaveLength(3);
    expect(swapped?.type === "split" && swapped.sizes).toEqual([70, 30]);
  });
});

describe("nextSplitDirection", () => {
  it("splits across the parent, and side by side at the top", () => {
    const row = createSplit("horizontal", [group("a"), group("b")], undefined, "row");
    expect(nextSplitDirection(row, "a")).toBe("vertical");
    expect(nextSplitDirection(group("a"), "a")).toBe("horizontal");
  });
});
