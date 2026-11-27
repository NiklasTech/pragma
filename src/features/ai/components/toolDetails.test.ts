import { describe, expect, it } from "vite-plus/test";

import { diffCounts, displayPath, lineDiff, toolDetails } from "./toolDetails";

describe("lineDiff", () => {
  it("keeps unchanged lines and lists removed before added lines", () => {
    expect(lineDiff("a\nb\nc\n", "a\nB\nc\nd\n")).toEqual([
      { kind: "context", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "B" },
      { kind: "context", text: "c" },
      { kind: "added", text: "d" },
    ]);
  });

  it("shows a new file as added lines", () => {
    const lines = lineDiff(null, "x\ny");
    expect(lines.every((line) => line.kind === "added")).toBe(true);
    expect(diffCounts(lines)).toEqual({ added: 2, removed: 0 });
  });
});

describe("toolDetails", () => {
  it("reads diffs and locations and skips broken entries", () => {
    expect(
      toolDetails({
        diffs: [{ path: "/a.ts", old_text: null, new_text: "x" }, { path: 3 }],
        locations: [{ path: "/a.ts", line: 4 }, { line: 2 }],
      }),
    ).toEqual({
      diffs: [{ path: "/a.ts", oldText: null, newText: "x" }],
      locations: [{ path: "/a.ts", line: 4 }],
    });
    expect(toolDetails(undefined)).toEqual({ diffs: [], locations: [] });
  });
});

describe("displayPath", () => {
  it("shows paths inside the folder relative to it", () => {
    expect(displayPath("/repo/src/a.ts", "/repo")).toBe("src/a.ts");
    expect(displayPath("/repo/src/a.ts", "/repo/")).toBe("src/a.ts");
    expect(displayPath("/other/a.ts", "/repo")).toBe("/other/a.ts");
  });
});
