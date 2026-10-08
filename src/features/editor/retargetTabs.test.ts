import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { movedPath, retargetTabs } from "./retargetTabs";

function fileTab(path: string): FileTab {
  return {
    id: path,
    kind: "file",
    path,
    name: path.split("/").pop() ?? path,
    content: "",
    originalContent: "",
    isModified: false,
  };
}

describe("movedPath", () => {
  it("maps the moved path and its descendants only", () => {
    expect(movedPath("/w/src", "/w/src", "/w/lib")).toBe("/w/lib");
    expect(movedPath("/w/src/a.ts", "/w/src", "/w/lib")).toBe("/w/lib/a.ts");
    expect(movedPath("/w/srcx/a.ts", "/w/src", "/w/lib")).toBeNull();
  });
});

describe("retargetTabs", () => {
  beforeEach(() => {
    useEditorStore.setState({
      tabs: [fileTab("/w/src/a.ts"), fileTab("/w/other.ts")],
      tabStates: [
        { tabId: "/w/src/a.ts", cursor: { line: 3, column: 1 }, scrollTop: 40 },
        { tabId: "/w/other.ts", cursor: { line: 0, column: 0 }, scrollTop: 0 },
      ],
      activeTabId: "/w/src/a.ts",
      activeTabIds: { main: "/w/src/a.ts", side: "/w/other.ts" },
      cursorPositions: { "/w/src/a.ts": { line: 3, column: 1 } },
      vimModes: {},
    });
  });

  it("moves tabs inside a moved folder and keeps their state", () => {
    retargetTabs("/w/src", "/w/lib/src");

    const state = useEditorStore.getState();
    expect(state.tabs.map((tab) => tab.id)).toEqual(["/w/lib/src/a.ts", "/w/other.ts"]);
    expect(state.tabs[0]).toMatchObject({ path: "/w/lib/src/a.ts", name: "a.ts" });
    expect(state.tabStates[0]).toMatchObject({ tabId: "/w/lib/src/a.ts", scrollTop: 40 });
    expect(state.activeTabId).toBe("/w/lib/src/a.ts");
    expect(state.activeTabIds).toEqual({ main: "/w/lib/src/a.ts", side: "/w/other.ts" });
    expect(state.cursorPositions).toEqual({ "/w/lib/src/a.ts": { line: 3, column: 1 } });
  });

  it("renames the tab when the file itself is renamed", () => {
    retargetTabs("/w/other.ts", "/w/renamed.ts");
    expect(useEditorStore.getState().tabs[1]).toMatchObject({
      id: "/w/renamed.ts",
      name: "renamed.ts",
    });
  });
});
