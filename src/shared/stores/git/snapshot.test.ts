import { describe, expect, it } from "vite-plus/test";

import { keepEqualSnapshot, sameGitStatusSnapshot } from "./snapshot";
import type { GitStatusSnapshot } from "./types";

function snapshot(paths: string[], branch = "main"): GitStatusSnapshot {
  return {
    repo: { repo_root: "/code/app", branch, upstream: "origin/main", is_detached: false },
    changed_files: paths.map((path) => ({
      path,
      status: "modified",
      status_code: ".M",
      is_staged: false,
      is_unstaged: true,
      is_conflicted: false,
      original_path: null,
    })),
    ahead: 0,
    behind: 0,
    untracked_omitted: 0,
  };
}

describe("sameGitStatusSnapshot", () => {
  it("treats snapshots with the same content as equal", () => {
    expect(sameGitStatusSnapshot(snapshot(["a.ts", "b.ts"]), snapshot(["a.ts", "b.ts"]))).toBe(
      true,
    );
  });

  it("sees a changed file list, branch or staging state", () => {
    const base = snapshot(["a.ts"]);
    expect(sameGitStatusSnapshot(base, snapshot(["a.ts", "b.ts"]))).toBe(false);
    expect(sameGitStatusSnapshot(base, snapshot(["a.ts"], "feature"))).toBe(false);
    const staged = snapshot(["a.ts"]);
    staged.changed_files[0].is_staged = true;
    expect(sameGitStatusSnapshot(base, staged)).toBe(false);
  });

  it("handles missing snapshots", () => {
    expect(sameGitStatusSnapshot(null, null)).toBe(true);
    expect(sameGitStatusSnapshot(null, snapshot([]))).toBe(false);
  });
});

describe("keepEqualSnapshot", () => {
  it("keeps the current object when nothing changed", () => {
    const current = snapshot(["a.ts"]);
    expect(keepEqualSnapshot(current, snapshot(["a.ts"]))).toBe(current);
  });

  it("takes the next object when something changed", () => {
    const next = snapshot(["b.ts"]);
    expect(keepEqualSnapshot(snapshot(["a.ts"]), next)).toBe(next);
    expect(keepEqualSnapshot(null, next)).toBe(next);
  });
});
