import { describe, expect, it } from "vite-plus/test";

import { commitMessageFor, commitPaths } from "./commit";
import type { ReviewRow } from "./rows";

describe("commitMessageFor", () => {
  it("prefers the task title and falls back to a named session title", () => {
    expect(commitMessageFor("  Fix login  ", "Session")).toBe("Fix login");
    expect(commitMessageFor(null, "Refactor parser")).toBe("Refactor parser");
    expect(commitMessageFor("", "New Chat")).toBe("");
    expect(commitMessageFor(null, null)).toBe("");
  });
});

describe("commitPaths", () => {
  it("collects the written files and the old path of renames, skipping pending edits", () => {
    const entry = (path: string, original_path: string | null = null) => ({
      path,
      status: "modified",
      status_code: "M",
      is_staged: false,
      is_unstaged: true,
      is_conflicted: false,
      original_path,
    });
    const rows: ReviewRow[] = [
      {
        id: "1",
        sessionId: "s",
        path: "a.ts",
        absolutePath: "/r/a.ts",
        fileKind: "modified",
        source: "git",
        gitEntry: entry("a.ts"),
      },
      {
        id: "2",
        sessionId: "s",
        path: "new.ts",
        absolutePath: "/r/new.ts",
        fileKind: "modified",
        source: "git",
        gitEntry: entry("new.ts", "old.ts"),
      },
      {
        id: "3",
        sessionId: "s",
        path: "pending.ts",
        absolutePath: "/r/pending.ts",
        fileKind: "modified",
        source: "edit",
      },
    ];

    expect(commitPaths(rows)).toEqual(["a.ts", "new.ts", "old.ts"]);
  });
});
