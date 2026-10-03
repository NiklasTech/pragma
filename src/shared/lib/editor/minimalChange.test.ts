import { describe, expect, it } from "vite-plus/test";
import { minimalChange } from "./minimalChange";

function apply(current: string, next: string): string {
  const change = minimalChange(current, next);
  return current.slice(0, change.from) + change.insert + current.slice(change.to);
}

describe("minimalChange", () => {
  it("replaces only the changed middle", () => {
    expect(minimalChange("const a = 1;\nconst b = 2;\n", "const a = 1;\nconst b = 3;\n")).toEqual({
      from: 23,
      to: 24,
      insert: "3",
    });
  });

  it("handles insertions, deletions and identical text", () => {
    expect(minimalChange("ac", "abc")).toEqual({ from: 1, to: 1, insert: "b" });
    expect(minimalChange("abc", "ac")).toEqual({ from: 1, to: 2, insert: "" });
    expect(minimalChange("same", "same")).toEqual({ from: 4, to: 4, insert: "" });
  });

  it("produces the target text for overlapping prefix and suffix", () => {
    for (const [current, next] of [
      ["aaa", "aaaa"],
      ["abab", "ab"],
      ["", "new file"],
      ["old file", ""],
      ["x\r\ny", "x\ny"],
    ]) {
      expect(apply(current, next)).toBe(next);
    }
  });
});
