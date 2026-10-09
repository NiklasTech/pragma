import { beforeEach, describe, expect, it } from "vite-plus/test";
import { MAX_CLOSED_TABS, useClosedTabsStore } from "./closedTabs";
import { useEditorStore } from "./editor";

describe("closed tabs", () => {
  beforeEach(() => {
    useClosedTabsStore.setState({ entries: [] });
    useEditorStore.setState({ tabs: [], tabStates: [], activeTabId: null, activeTabIds: {} });
  });

  it("pops the most recently closed tab first", () => {
    const { push, pop } = useClosedTabsStore.getState();
    push({ path: "/a.ts", cursor: null });
    push({ path: "/b.ts", cursor: { line: 3, column: 2 } });

    expect(pop()).toEqual({ path: "/b.ts", cursor: { line: 3, column: 2 } });
    expect(pop()).toEqual({ path: "/a.ts", cursor: null });
    expect(pop()).toBeNull();
  });

  it("keeps one entry per path and caps the stack", () => {
    const { push } = useClosedTabsStore.getState();
    for (let i = 0; i < MAX_CLOSED_TABS + 5; i++) {
      push({ path: `/file-${i}.ts`, cursor: null });
    }
    push({ path: `/file-${MAX_CLOSED_TABS}.ts`, cursor: null });

    const { entries } = useClosedTabsStore.getState();
    expect(entries).toHaveLength(MAX_CLOSED_TABS);
    expect(entries.filter((e) => e.path === `/file-${MAX_CLOSED_TABS}.ts`)).toHaveLength(1);
    expect(entries[entries.length - 1]?.path).toBe(`/file-${MAX_CLOSED_TABS}.ts`);
  });

  it("records file tabs with their cursor when they are closed", () => {
    const editor = useEditorStore.getState();
    editor.openFile({
      id: "/src/main.ts",
      path: "/src/main.ts",
      name: "main.ts",
      content: "",
      originalContent: "",
      isModified: false,
    });
    editor.setCursorPosition("/src/main.ts", { line: 12, column: 4 });
    editor.closeTab("/src/main.ts");

    expect(useClosedTabsStore.getState().entries).toEqual([
      { path: "/src/main.ts", cursor: { line: 12, column: 4 } },
    ]);
  });

  it("does not record diff tabs", () => {
    const editor = useEditorStore.getState();
    editor.openDiff({
      path: "/src/main.ts",
      original: "",
      modified: "",
      patchText: "",
      staged: false,
    });
    editor.closeTab("diff:/src/main.ts:unstaged");

    expect(useClosedTabsStore.getState().entries).toEqual([]);
  });
});
