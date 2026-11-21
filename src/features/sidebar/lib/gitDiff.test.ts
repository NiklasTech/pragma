import { describe, expect, it } from "vite-plus/test";
import { useEditorStore } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout/store";
import { allPanelIds, createPanel, createSplit, createTabs } from "@/shell/layout/tree/operations";
import { openGitDiff } from "./gitDiff";

describe("openGitDiff", () => {
  it("opens the diff as a tab of the focused panel without splitting the editor", () => {
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

    openGitDiff(editorPanel.id, {
      id: "diff:src/a.ts:unstaged",
      path: "src/a.ts",
      original: "const a = 1;",
      modified: "const a = 2;",
      patchText: "patch",
      staged: false,
    });

    const editor = useEditorStore.getState();
    expect(editor.getPanelActiveTabId(editorPanel.id)).toBe("diff:src/a.ts:unstaged");
    expect(allPanelIds(useLayoutStore.getState().root)).toHaveLength(2);
  });
});
