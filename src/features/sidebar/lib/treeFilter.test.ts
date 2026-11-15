import { describe, expect, it } from "vite-plus/test";

import { filterWorkspaceFiles } from "./treeFilter";

const files = ["src/diff.rs", "src/pty.rs", "src/git/Diff.tsx", "README.md"];

describe("filterWorkspaceFiles", () => {
  it("builds the matching files into a tree, folders first, case-insensitively", () => {
    const shown = filterWorkspaceFiles("/r", files, "DIFF").map(({ node, depth }) => [
      node.path,
      depth,
      node.isDirectory,
    ]);
    expect(shown).toEqual([
      ["/r/src", 0, true],
      ["/r/src/git", 1, true],
      ["/r/src/git/Diff.tsx", 2, false],
      ["/r/src/diff.rs", 1, false],
    ]);
  });

  it("matches folder names in the path and shows nothing for an empty query", () => {
    expect(filterWorkspaceFiles("/r", files, "git").map(({ node }) => node.name)).toEqual([
      "src",
      "git",
      "Diff.tsx",
    ]);
    expect(filterWorkspaceFiles("/r", files, "  ")).toEqual([]);
  });
});
