import { describe, expect, it } from "vite-plus/test";
import {
  createPanel,
  createSplit,
  createTabs,
  findNode,
  findPanelByKind,
  insertAdjacent,
  moveNode,
  removeNode,
  cleanupTree,
  distributeSizes,
} from "./operations";

describe("layout tree operations", () => {
  it("distributes equal sizes", () => {
    expect(distributeSizes(2)).toEqual([50, 50]);
    expect(distributeSizes(4)).toEqual([25, 25, 25, 25]);
    expect(distributeSizes(0)).toEqual([]);
  });

  it("creates a split with balanced sizes", () => {
    const split = createSplit("horizontal", [createPanel("editor"), createPanel("terminal")]);
    expect(split.sizes).toEqual([50, 50]);
  });

  it("finds a nested panel", () => {
    const editor = createPanel("editor");
    const root = createSplit("vertical", [createTabs([editor]), createPanel("terminal")]);
    expect(findNode(root, editor.id)?.type).toBe("panel");
    expect(findNode(root, "missing")).toBeNull();
  });

  it("removes a panel and collapses empty split", () => {
    const terminal = createPanel("terminal");
    const root = createSplit("horizontal", [createPanel("editor"), terminal]);
    const next = removeNode(root, terminal.id);
    expect(next?.type).toBe("panel");
  });

  it("inserts adjacent to a panel", () => {
    const editor = createPanel("editor");
    const root = createSplit("vertical", [editor, createPanel("terminal")]);
    const inserted = createPanel("output");
    const next = insertAdjacent(root, editor.id, "right", inserted);
    expect(next.type).toBe("split");
    const top = next as ReturnType<typeof createSplit>;
    expect(top.direction).toBe("vertical");
    expect(top.children[0]?.type).toBe("split");
    expect((top.children[0] as ReturnType<typeof createSplit>).direction).toBe("horizontal");
  });

  it("moves a panel to a new zone", () => {
    const a = createPanel("editor");
    const b = createPanel("terminal");
    const root = createSplit("vertical", [a, b]);
    const next = moveNode(root, a.id, { nodeId: b.id, zone: "right" });
    expect(next.type).toBe("split");
    expect((next as ReturnType<typeof createSplit>).direction).toBe("horizontal");
  });

  it("cleans up nested splits of same direction", () => {
    const inner = createSplit("horizontal", [createPanel("editor"), createPanel("terminal")]);
    const root = createSplit("horizontal", [inner, createPanel("output")]);
    const cleaned = cleanupTree(root);
    expect(cleaned.type).toBe("split");
    expect((cleaned as ReturnType<typeof createSplit>).children).toHaveLength(3);
  });

  it("finds a panel by kind", () => {
    const editor = createPanel("editor");
    const root = createSplit("vertical", [createTabs([editor]), createPanel("terminal")]);
    expect(findPanelByKind(root, "editor")?.id).toBe(editor.id);
    expect(findPanelByKind(root, "output")).toBeNull();
  });

  it("splits the tab container, not the inner panel, on edge drop", () => {
    const editor = createPanel("editor");
    const editorTabs = createTabs([editor]);
    const terminal = createPanel("terminal");
    const root = createSplit("vertical", [editorTabs, createTabs([terminal])]);

    const next = moveNode(root, terminal.id, { nodeId: editor.id, zone: "bottom" });
    expect(next.type).toBe("split");
    const split = next as ReturnType<typeof createSplit>;
    expect(split.direction).toBe("vertical");
    expect(split.children).toHaveLength(2);
    expect(split.children[0]?.id).toBe(editorTabs.id);
    expect(split.children[1]?.type).toBe("panel");
  });

  it("splits adjacent to a tab container inside a split of the same direction", () => {
    const editor = createPanel("editor");
    const editorTabs = createTabs([editor]);
    const terminal = createPanel("terminal");
    const output = createPanel("output");
    const root = createSplit("vertical", [editorTabs, terminal, output]);

    const next = moveNode(root, terminal.id, { nodeId: editor.id, zone: "bottom" });
    expect(next.type).toBe("split");
    const split = next as ReturnType<typeof createSplit>;
    expect(split.direction).toBe("vertical");
    expect(split.children).toHaveLength(3);
    expect(split.children[1]?.type).toBe("panel");
    expect((split.children[1] as ReturnType<typeof createPanel>).kind).toBe("terminal");
  });
});
