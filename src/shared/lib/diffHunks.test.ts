import { describe, expect, it } from "vite-plus/test";
import {
  hunkPlace,
  hunkSection,
  lineNumberDigits,
  lineSelection,
  longestLine,
  parsePatchHunks,
  patchLineKey,
} from "./diffHunks";

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

describe("line numbers of a hunk", () => {
  const hunks = parsePatchHunks(
    [
      "@@ -9,3 +9,3 @@ function add() {",
      "-old",
      "+new",
      " same",
      "@@ -120,2 +118,0 @@",
      "-gone",
      "-too",
    ].join("\n"),
  );

  it("places a hunk by its new lines, and by the old ones when nothing is left", () => {
    expect(hunkPlace(hunks[0])).toBe("lines 9–10");
    expect(hunkPlace(hunks[1])).toBe("lines 120–121");
    expect(hunkPlace({ lines: [] })).toBe("");
  });

  it("reads the section git names", () => {
    expect(hunkSection(hunks[0].header)).toBe("function add() {");
    expect(hunkSection(hunks[1].header)).toBe("");
  });

  it("sizes the numbers and the longest line", () => {
    expect(lineNumberDigits(hunks)).toBe(3);
    expect(lineNumberDigits([])).toBe(2);
    expect(longestLine([{ lines: parsePatchHunks("@@ -1 +1 @@\n+\tab")[0].lines }])).toBe(6);
  });
});
