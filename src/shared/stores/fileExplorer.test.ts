import { describe, expect, it } from "vite-plus/test";
import { mergePersistedFileExplorer, useFileExplorerStore } from "./fileExplorer";

describe("mergePersistedFileExplorer", () => {
  it("keeps the current state when nothing was saved for the window", () => {
    const current = useFileExplorerStore.getState();

    const merged = mergePersistedFileExplorer(undefined, current);

    expect(merged.rootPath).toBe(current.rootPath);
    expect(merged.expandedDirs).toEqual(new Set());
  });

  it("restores the saved root path and expanded folders", () => {
    const merged = mergePersistedFileExplorer(
      { rootPath: "/project", expandedDirs: ["/project/src"] },
      useFileExplorerStore.getState(),
    );

    expect(merged.rootPath).toBe("/project");
    expect(merged.expandedDirs).toEqual(new Set(["/project/src"]));
  });
});
