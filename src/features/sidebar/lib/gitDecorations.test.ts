import { describe, expect, it } from "vite-plus/test";

import type { GitStatusEntry, GitStatusSnapshot } from "@/shared/stores/git/types";

import { buildGitDecorations } from "./gitDecorations";

function entry(path: string, statusCode: string, conflicted = false): GitStatusEntry {
  return {
    path,
    status: "",
    status_code: statusCode,
    is_staged: false,
    is_unstaged: true,
    is_conflicted: conflicted,
    original_path: null,
  };
}

function snapshot(files: GitStatusEntry[]): GitStatusSnapshot {
  return {
    repo: { repo_root: "/repo", branch: "main", upstream: null, is_detached: false },
    changed_files: files,
    ahead: 0,
    behind: 0,
  };
}

describe("buildGitDecorations", () => {
  it("returns empty decorations without a snapshot", () => {
    const decorations = buildGitDecorations(null, "/repo");
    expect(decorations.files.size).toBe(0);
    expect(decorations.dirtyDirs.size).toBe(0);
  });

  it("maps status codes to absolute paths and marks ancestor folders", () => {
    const decorations = buildGitDecorations(
      snapshot([
        entry("src/app/App.tsx", "M"),
        entry("notes.md", "?"),
        entry("src/old.ts", "D"),
        entry("src/merge.ts", "M", true),
      ]),
      "/repo",
    );

    expect(decorations.files.get("/repo/src/app/App.tsx")).toEqual({
      kind: "modified",
      letter: "M",
    });
    expect(decorations.files.get("/repo/notes.md")).toEqual({ kind: "untracked", letter: "U" });
    expect(decorations.files.get("/repo/src/old.ts")?.kind).toBe("deleted");
    expect(decorations.files.get("/repo/src/merge.ts")?.kind).toBe("conflict");
    expect([...decorations.dirtyDirs].sort()).toEqual(["/repo/src", "/repo/src/app"]);
  });

  it("uses the tree's Windows paths, not the canonical repo root", () => {
    const status = snapshot([entry("src/app/App.tsx", "M")]);
    status.repo.repo_root = "\\\\?\\C:\\code\\repo";

    const decorations = buildGitDecorations(status, "C:\\code\\repo");

    expect(decorations.files.get("C:\\code\\repo\\src\\app\\App.tsx")?.letter).toBe("M");
    expect([...decorations.dirtyDirs].sort()).toEqual([
      "C:\\code\\repo\\src",
      "C:\\code\\repo\\src\\app",
    ]);
  });
});
