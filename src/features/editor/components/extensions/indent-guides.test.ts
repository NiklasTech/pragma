import { describe, expect, it } from "vite-plus/test";
import { guideColumns, lineIndentColumns } from "./indent-guides";

describe("lineIndentColumns", () => {
  it("measures spaces and tabs as visual columns", () => {
    expect(lineIndentColumns("    a", 4)).toBe(4);
    expect(lineIndentColumns("\ta", 4)).toBe(4);
    expect(lineIndentColumns("  \ta", 4)).toBe(4);
    expect(lineIndentColumns("a", 4)).toBe(0);
  });

  it("returns null for blank lines", () => {
    expect(lineIndentColumns("", 4)).toBeNull();
    expect(lineIndentColumns("   \t", 4)).toBeNull();
  });
});

describe("guideColumns", () => {
  it("places a guide at every indent unit before the text", () => {
    expect(guideColumns(0, 2)).toEqual([]);
    expect(guideColumns(4, 2)).toEqual([0, 2]);
    expect(guideColumns(5, 2)).toEqual([0, 2, 4]);
  });
});
