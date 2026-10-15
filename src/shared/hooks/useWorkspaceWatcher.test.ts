import { describe, expect, it } from "vite-plus/test";

import { treeShowsRoot, watchedRoots } from "./useWorkspaceWatcher";

describe("watchedRoots", () => {
  const paths = ["/code/a", "/code/b"];

  it("watches every open repository", () => {
    expect(watchedRoots("/code/a", paths)).toEqual(paths);
  });

  it("adds an active folder that is not in the list of open repositories", () => {
    expect(watchedRoots("/code/c", paths)).toEqual(["/code/c", ...paths]);
  });

  it("watches nothing without a folder", () => {
    expect(watchedRoots(null, paths)).toEqual([]);
  });
});

describe("treeShowsRoot", () => {
  it("refreshes the tree only for repositories the explorer shows", () => {
    expect(treeShowsRoot("/code/a", "/code/a", false)).toBe(true);
    expect(treeShowsRoot("/code/b", "/code/a", false)).toBe(false);
    expect(treeShowsRoot("/code/b", "/code/a", true)).toBe(true);
  });
});
