import { describe, expect, it } from "vite-plus/test";

import { explainWorktreeError } from "./worktreeErrors";

describe("explainWorktreeError", () => {
  it("names a leftover lock file", () => {
    const result = explainWorktreeError(
      "git worktree add failed: fatal: Unable to create '/repo/.git/index.lock': File exists.",
    );
    expect(result.title).toBe("Git is busy with another operation");
    expect(result.detail).toContain("/repo/.git/index.lock");
  });

  it("recognizes a full disk, a missing git and a folder that is not a repository", () => {
    expect(explainWorktreeError("error: unable to write file: No space left on device").title).toBe(
      "The disk is full",
    );
    expect(explainWorktreeError("git is not available on PATH. Install Git and retry.").title).toBe(
      "Git was not found",
    );
    expect(explainWorktreeError("fatal: not a git repository (or any parent)").title).toBe(
      "This folder is not a git repository",
    );
    expect(explainWorktreeError("git worktree add timed out").title).toBe("Git took too long");
  });

  it("keeps git's text for anything else", () => {
    expect(explainWorktreeError("  fatal: something odd  ")).toEqual({
      title: "Could not create the worktree",
      detail: "fatal: something odd",
    });
  });
});
