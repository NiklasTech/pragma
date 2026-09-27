import { describe, expect, it } from "vite-plus/test";
import { useEditorStore } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout/store";
import {
  allPanelIds,
  createPanel,
  createSplit,
  createTabs,
  findParent,
} from "@/shell/layout/tree/operations";
import { diffSplitSizes, openGitDiffInSplit } from "./gitDiffSplit";

function setupEditor(): { editorPanelId: string; terminalPanelId: string } {
  const editorPanel = createPanel("editor");
  const terminalPanel = createPanel("terminal");
  const root = createSplit("vertical", [createTabs([editorPanel]), terminalPanel], [65, 35]);

  useLayoutStore.setState({ root, floating: [], activePreset: null, isCustomized: false });
  useEditorStore.setState({
    tabs: [],
    tabStates: [],
    activeTabId: null,
    activeTabIds: {},
    lastFocusedPanelId: editorPanel.id,
  });
  useEditorStore.getState().openFile(
    {
      id: "file-1",
      path: "src/a.ts",
      name: "a.ts",
      content: "const a = 1;",
      originalContent: "const a = 1;",
      isModified: false,
    },
    editorPanel.id,
  );

  return { editorPanelId: editorPanel.id, terminalPanelId: terminalPanel.id };
}

function gitDiff() {
  return {
    id: "diff:src/a.ts:unstaged",
    path: "src/a.ts",
    original: "const a = 1;",
    modified: "const a = 2;",
    patchText: "patch",
    staged: false,
  };
}

describe("diffSplitSizes", () => {
  it("keeps the diff at 35 percent and shares the rest", () => {
    expect(diffSplitSizes(["a", "b"], "b")).toEqual([65, 35]);
    expect(diffSplitSizes(["a", "b", "c"], "b")).toEqual([32.5, 35, 32.5]);
  });
});

describe("openGitDiffInSplit", () => {
  it("keeps the file visible and shows the diff in a new editor panel", () => {
    const { editorPanelId, terminalPanelId } = setupEditor();
    const diff = gitDiff();

    openGitDiffInSplit(editorPanelId, diff);

    const editor = useEditorStore.getState();
    expect(editor.getPanelActiveTabId(editorPanelId)).toBe("file-1");
    expect(editor.tabs.some((tab) => tab.id === diff.id && tab.kind === "diff")).toBe(true);

    const diffPanelId = allPanelIds(useLayoutStore.getState().root).find(
      (panelId) => panelId !== editorPanelId && panelId !== terminalPanelId,
    );
    expect(diffPanelId).toBeDefined();
    expect(editor.getPanelActiveTabId(diffPanelId ?? null)).toBe(diff.id);
  });

  it("sizes the diff split to about 35 percent", () => {
    const { editorPanelId, terminalPanelId } = setupEditor();
    openGitDiffInSplit(editorPanelId, gitDiff());

    const root = useLayoutStore.getState().root;
    const diffPanelId = allPanelIds(root).find(
      (panelId) => panelId !== editorPanelId && panelId !== terminalPanelId,
    );
    const ref = diffPanelId ? findParent(root, diffPanelId) : null;
    if (!ref || ref.parent.type !== "split") throw new Error("expected a split parent");

    const index = ref.parent.children.findIndex((child) => child.id === diffPanelId);
    expect(ref.parent.sizes[index]).toBe(35);
  });

  it("reuses the open diff panel instead of splitting again", () => {
    const { editorPanelId } = setupEditor();
    openGitDiffInSplit(editorPanelId, gitDiff());
    const panelCount = allPanelIds(useLayoutStore.getState().root).length;

    const next = { ...gitDiff(), id: "diff:src/b.ts:unstaged", path: "src/b.ts" };
    openGitDiffInSplit(editorPanelId, next);

    const root = useLayoutStore.getState().root;
    expect(allPanelIds(root)).toHaveLength(panelCount);
    const editor = useEditorStore.getState();
    expect(editor.getPanelActiveTabId(editorPanelId)).toBe("file-1");
    const diffPanelId = allPanelIds(root).find(
      (panelId) => editor.getPanelActiveTabId(panelId) === next.id,
    );
    expect(diffPanelId).toBeDefined();
  });

  it("shows the diff in place when the diff panel is focused", () => {
    const { editorPanelId } = setupEditor();
    openGitDiffInSplit(editorPanelId, gitDiff());
    const root = useLayoutStore.getState().root;
    const panelCount = allPanelIds(root).length;
    const diffPanelId = allPanelIds(root).find(
      (panelId) => useEditorStore.getState().activeTabIds[panelId] === gitDiff().id,
    );
    if (!diffPanelId) throw new Error("expected a diff panel");

    const next = { ...gitDiff(), id: "diff:src/b.ts:unstaged", path: "src/b.ts" };
    openGitDiffInSplit(diffPanelId, next);

    expect(allPanelIds(useLayoutStore.getState().root)).toHaveLength(panelCount);
    expect(useEditorStore.getState().getPanelActiveTabId(diffPanelId)).toBe(next.id);
  });

  it("closes the diff panel when its last diff tab closes", () => {
    const { editorPanelId, terminalPanelId } = setupEditor();
    const diff = gitDiff();
    openGitDiffInSplit(editorPanelId, diff);
    expect(allPanelIds(useLayoutStore.getState().root)).toHaveLength(3);

    useEditorStore.getState().closeTab(diff.id);

    expect(allPanelIds(useLayoutStore.getState().root).sort()).toEqual(
      [editorPanelId, terminalPanelId].sort(),
    );
    expect(useEditorStore.getState().getPanelActiveTabId(editorPanelId)).toBe("file-1");
  });

  it("falls back to a global diff tab without an editor panel", () => {
    useEditorStore.setState({
      tabs: [],
      tabStates: [],
      activeTabId: null,
      activeTabIds: {},
      lastFocusedPanelId: null,
    });
    const diff = gitDiff();

    openGitDiffInSplit(null, diff);

    expect(useEditorStore.getState().activeTabId).toBe(diff.id);
  });
});
