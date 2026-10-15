import { beforeEach, describe, expect, it } from "vite-plus/test";
import { mergePersistedFileExplorer, switchRepository, useFileExplorerStore } from "./fileExplorer";

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

describe("explorer state per repository", () => {
  beforeEach(() => {
    useFileExplorerStore.setState({
      rootPath: null,
      expandedDirs: new Set(),
      selectedPath: null,
      savedStates: {},
    });
  });

  it("restores A's expanded folders and selection after switching to B and back", () => {
    const store = useFileExplorerStore.getState();
    store.setRootPath("/code/a");
    store.expandDir("/code/a/src");
    store.setSelectedPath("/code/a/src/main.ts");

    store.setRootPath("/code/b");
    expect(useFileExplorerStore.getState().expandedDirs).toEqual(new Set());
    expect(useFileExplorerStore.getState().selectedPath).toBeNull();
    store.expandDir("/code/b/docs");

    store.setRootPath("/code/a");
    const restored = useFileExplorerStore.getState();
    expect(restored.expandedDirs).toEqual(new Set(["/code/a/src"]));
    expect(restored.selectedPath).toBe("/code/a/src/main.ts");
    expect(restored.savedStates).toEqual({
      "/code/b": { expandedDirs: ["/code/b/docs"], selectedPath: null },
    });
  });

  it("starts collapsed when the same root is selected again", () => {
    const next = switchRepository(
      {
        rootPath: "/code/a",
        expandedDirs: new Set(["/code/a/src"]),
        selectedPath: "/code/a/x.ts",
        savedStates: {},
      },
      "/code/a",
    );
    expect(next.expandedDirs).toEqual(new Set());
    expect(next.selectedPath).toBe("/code/a/x.ts");
  });

  it("keeps one expanded set for all repositories while all of them are shown", () => {
    const store = useFileExplorerStore.getState();
    store.setShowAllRepositories(true);
    store.setRootPath("/code/a");
    store.expandDir("/code/a/src");
    store.expandDir("/code/b/docs");

    store.setRootPath("/code/b");

    expect(useFileExplorerStore.getState().expandedDirs).toEqual(
      new Set(["/code/a/src", "/code/b/docs"]),
    );
    store.setShowAllRepositories(false);
  });

  it("forgets the state of a closed repository", () => {
    const store = useFileExplorerStore.getState();
    store.setRootPath("/code/a");
    store.expandDir("/code/a/src");
    store.setRootPath("/code/b");
    store.forgetRepository("/code/a");

    store.setRootPath("/code/a");
    expect(useFileExplorerStore.getState().expandedDirs).toEqual(new Set());
  });

  it("restores saved states of a persisted window", () => {
    const merged = mergePersistedFileExplorer(
      {
        rootPath: "/code/a",
        savedStates: { "/code/b": { expandedDirs: ["/code/b/src"], selectedPath: null } },
      },
      useFileExplorerStore.getState(),
    );
    expect(merged.savedStates["/code/b"]?.expandedDirs).toEqual(["/code/b/src"]);
  });
});
