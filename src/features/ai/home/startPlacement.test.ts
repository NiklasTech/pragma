import { describe, expect, it } from "vite-plus/test";

import { startPlacement } from "./startPlacement";

describe("startPlacement", () => {
  it("gives every agent of a team its own worktree in a repository", () => {
    expect(
      startPlacement({ several: true, setting: undefined, noGit: false, single: "checkout" }),
    ).toEqual({ groupMode: "isolated", label: "each in its own worktree" });
  });

  it("says that a team shares a folder without Git", () => {
    expect(
      startPlacement({ several: true, setting: undefined, noGit: true, single: "checkout" }),
    ).toEqual({ groupMode: "checkout", label: "all in this folder (no Git)" });
  });

  it("keeps a team in the checkout when the project asks for it", () => {
    expect(
      startPlacement({ several: true, setting: "checkout", noGit: false, single: "checkout" }),
    ).toEqual({ groupMode: "checkout", label: "all in this folder" });
  });

  it("never promises a worktree for a single agent without Git", () => {
    expect(
      startPlacement({ several: false, setting: "worktree", noGit: true, single: "worktree" })
        .label,
    ).toBe("in this folder");
    expect(
      startPlacement({ several: false, setting: undefined, noGit: false, single: "worktree" })
        .label,
    ).toBe("in a new worktree");
  });
});
