import { describe, expect, it } from "vite-plus/test";

import { watchedRoots } from "./useWorkspaceWatcher";

describe("watchedRoots", () => {
  const paths = ["/code/a", "/code/b"];

  it("watches only the active repository by default", () => {
    expect(watchedRoots("/code/a", false, paths)).toEqual(["/code/a"]);
  });

  it("watches every open repository while the explorer shows all of them", () => {
    expect(watchedRoots("/code/a", true, paths)).toEqual(paths);
  });

  it("watches nothing without a folder", () => {
    expect(watchedRoots(null, true, paths)).toEqual([]);
  });
});
