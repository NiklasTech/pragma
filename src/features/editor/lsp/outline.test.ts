import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/shell/layout/store", () => ({ useLayoutStore: { getState: () => ({}) } }));
vi.mock("@/shared/stores/commandPalette", () => ({
  useCommandPaletteStore: () => ({ registerCommand: vi.fn(), unregisterCommand: vi.fn() }),
}));

import { buildOutlineTree, outlineNodeKey } from "./outline";
import type { LspDocumentSymbolItem } from "./client";

function symbol(name: string, depth: number): LspDocumentSymbolItem {
  return {
    name,
    kind: 12,
    depth,
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: name.length },
    },
  };
}

describe("buildOutlineTree", () => {
  it("nests symbols by depth", () => {
    const tree = buildOutlineTree([
      symbol("Class", 0),
      symbol("method", 1),
      symbol("nested", 2),
      symbol("other", 1),
      symbol("TopLevel", 0),
    ]);

    expect(tree.map((node) => node.item.name)).toEqual(["Class", "TopLevel"]);
    expect(tree[0].children.map((node) => node.item.name)).toEqual(["method", "other"]);
    expect(tree[0].children[0].children.map((node) => node.item.name)).toEqual(["nested"]);
    expect(tree[1].children).toEqual([]);
  });

  it("clamps a depth jump to the nearest available parent", () => {
    const tree = buildOutlineTree([symbol("Class", 0), symbol("deep", 4)]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((node) => node.item.name)).toEqual(["deep"]);
  });

  it("starts a new root when depth returns to zero", () => {
    const tree = buildOutlineTree([
      symbol("a", 0),
      symbol("a.child", 1),
      symbol("b", 0),
      symbol("b.child", 1),
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[1].children).toHaveLength(1);
    expect(tree[0].children[0].item.name).toBe("a.child");
  });

  it("returns an empty tree for no symbols", () => {
    expect(buildOutlineTree([])).toEqual([]);
  });
});

describe("outlineNodeKey", () => {
  it("stays unique for same-named siblings", () => {
    const first = buildOutlineTree([symbol("x", 0)])[0];
    const second = buildOutlineTree([symbol("x", 0)])[0];
    expect(outlineNodeKey(first, "", 0)).not.toBe(outlineNodeKey(second, "", 1));
  });

  it("changes with the parent key", () => {
    const node = buildOutlineTree([symbol("x", 0)])[0];
    expect(outlineNodeKey(node, "", 0)).not.toBe(outlineNodeKey(node, "/0:a", 0));
  });
});
