import { describe, expect, it } from "vite-plus/test";
import { baseName, canMoveInto, joinPath } from "./fileTreeActions";

describe("canMoveInto", () => {
  it("rejects moves into the current parent, the folder itself or its descendants", () => {
    expect(canMoveInto("/w/src/a.ts", "/w/src")).toBe(false);
    expect(canMoveInto("/w/src", "/w/src")).toBe(false);
    expect(canMoveInto("/w/src", "/w/src/nested")).toBe(false);
    expect(canMoveInto("/w/src/a.ts", "/w/lib")).toBe(true);
    expect(canMoveInto("/w/src", "/w/srcx")).toBe(true);
  });
});

describe("joinPath and baseName", () => {
  it("keep the separator style of the target", () => {
    expect(joinPath("/w/lib", "a.ts")).toBe("/w/lib/a.ts");
    expect(joinPath("C:\\w\\lib", "a.ts")).toBe("C:\\w\\lib\\a.ts");
    expect(baseName("C:\\w\\lib\\a.ts")).toBe("a.ts");
  });
});
