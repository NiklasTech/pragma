import { describe, expect, it } from "vite-plus/test";

import type { GitStatusSnapshot } from "@/shared/stores/git";

import { inactiveRepositories, summarizeGitRepositories } from "./gitRepositories";

function snapshot(branch: string, files: number): GitStatusSnapshot {
  return {
    repo: { repo_root: "/", branch, upstream: null, is_detached: false },
    changed_files: Array.from({ length: files }, (_, index) => ({
      path: `file-${index}`,
      status: "modified",
      status_code: "M",
      is_staged: false,
      is_unstaged: true,
      is_conflicted: false,
      original_path: null,
    })),
    ahead: 0,
    behind: 0,
  };
}

describe("git repositories", () => {
  const paths = ["/code/a", "/code/b", "/code/c"];

  it("loads the status of every repository besides the active one", () => {
    expect(inactiveRepositories(paths, "/code/b")).toEqual(["/code/a", "/code/c"]);
  });

  it("takes the active repository from the git store and the others from their own status", () => {
    const byRoot = {
      "/code/b": { snapshot: snapshot("feature", 3), loading: false, error: null, busy: false },
    };

    expect(summarizeGitRepositories(paths, "/code/a", snapshot("main", 1), byRoot)).toEqual([
      { path: "/code/a", name: "a", branch: "main", changes: 1, active: true },
      { path: "/code/b", name: "b", branch: "feature", changes: 3, active: false },
      { path: "/code/c", name: "c", branch: null, changes: 0, active: false },
    ]);
  });
});
