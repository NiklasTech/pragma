import { describe, expect, it } from "vite-plus/test";
import { lineSelection, parsePatchHunks, patchLineKey } from "./diffHunks";

const PATCH = [
  "diff --git a/file.txt b/file.txt",
  "index 1111111..2222222 100644",
  "--- a/file.txt",
  "+++ b/file.txt",
  "@@ -1,3 +1,3 @@",
  " one",
  "-two",
  "+TWO",
  " three",
  "@@ -10,2 +10,3 @@ fn main",
  " ten",
  "+added",
  " eleven",
  "",
].join("\n");

describe("parsePatchHunks", () => {
  it("numbers lines on both sides", () => {
    const hunks = parsePatchHunks(PATCH);

    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.lines).toEqual([
      { type: "context", content: "one", oldLine: 1, newLine: 1 },
      { type: "removed", content: "two", oldLine: 2, newLine: null },
      { type: "added", content: "TWO", oldLine: null, newLine: 2 },
      { type: "context", content: "three", oldLine: 3, newLine: 3 },
    ]);
    expect(hunks[1]?.header).toBe("@@ -10,2 +10,3 @@ fn main");
    expect(hunks[1]?.lines[1]).toEqual({
      type: "added",
      content: "added",
      oldLine: null,
      newLine: 11,
    });
  });

  it("ignores the file header and no-newline markers", () => {
    const hunks = parsePatchHunks(
      "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n",
    );

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.lines.map((line) => line.type)).toEqual(["removed", "added"]);
  });

  it("returns no hunks for an empty patch", () => {
    expect(parsePatchHunks("")).toEqual([]);
  });
});

describe("lineSelection", () => {
  it("collects removed and added line numbers and skips context", () => {
    const [hunk] = parsePatchHunks(PATCH);

    expect(lineSelection(hunk?.lines ?? [])).toEqual({ old_lines: [2], new_lines: [2] });
  });
});

describe("patchLineKey", () => {
  it("distinguishes removed and added lines with the same number", () => {
    const [hunk] = parsePatchHunks(PATCH);
    const keys = hunk?.lines.slice(1, 3).map(patchLineKey);

    expect(keys).toEqual(["-2", "+2"]);
  });
});
