import { describe, expect, it } from "vite-plus/test";

import type { GitStatusEntry } from "@/shared/stores/git";

import { fileState, stageState } from "./fileState";

function entry(patch: Partial<GitStatusEntry>): GitStatusEntry {
  return {
    path: "src/a.ts",
    status: "modified",
    status_code: "M",
    is_staged: false,
    is_unstaged: true,
    is_conflicted: false,
    original_path: null,
    ...patch,
  };
}

describe("fileState", () => {
  it("reads git's status code as one letter", () => {
    expect(fileState(entry({ status_code: "M" }))).toBe("M");
    expect(fileState(entry({ status_code: "A" }))).toBe("A");
    expect(fileState(entry({ status_code: "?" }))).toBe("U");
    expect(fileState(entry({ status_code: "D" }))).toBe("D");
    expect(fileState(entry({ status_code: "R" }))).toBe("R");
  });

  it("counts a file with an original path as moved", () => {
    expect(fileState(entry({ status_code: "M", original_path: "lib/a.ts" }))).toBe("R");
  });
});

describe("stageState", () => {
  it("tells staged, partly staged and not staged apart", () => {
    expect(stageState(entry({ is_staged: true, is_unstaged: false }))).toBe("staged");
    expect(stageState(entry({ is_staged: true, is_unstaged: true }))).toBe("part");
    expect(stageState(entry({ is_staged: false, is_unstaged: true }))).toBe("none");
  });
});
