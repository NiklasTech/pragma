import { describe, expect, it } from "vite-plus/test";

import type { PatchLine } from "@/shared/lib/diffHunks";

import { hunkKey, reviewTally, type UndoneHunk } from "./hunkReview";

const line = (type: PatchLine["type"], content: string, at: number): PatchLine => ({
  type,
  content,
  oldLine: type === "added" ? null : at,
  newLine: type === "removed" ? null : at,
});

describe("hunkKey", () => {
  it("ignores context and line numbers, so a moved part keeps its key", () => {
    const first = { lines: [line("context", "a", 1), line("added", "b", 2)] };
    const moved = { lines: [line("context", "x", 40), line("added", "b", 41)] };
    expect(hunkKey("f.ts", first)).toBe(hunkKey("f.ts", moved));
    expect(hunkKey("g.ts", first)).not.toBe(hunkKey("f.ts", first));
  });
});

describe("reviewTally", () => {
  it("counts kept, undone and open parts", () => {
    const undone: UndoneHunk[] = [
      { key: "u", path: "f.ts", header: "@@", lines: [], before: "", after: "" },
    ];
    expect(reviewTally(["a", "b", "c"], new Set(["a", "zz"]), undone)).toEqual({
      total: 4,
      kept: 1,
      undone: 1,
      open: 2,
    });
  });
});
