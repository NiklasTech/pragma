import { describe, expect, it } from "vite-plus/test";

import { locateSymbol } from "./lspTools";

const content = [
  "const value = 1;",
  "function getValue() {",
  "  return value + valueOf;",
  "}",
].join("\n");

describe("locateSymbol", () => {
  it("converts a 1-based line and symbol into a 0-based LSP position", () => {
    expect(locateSymbol(content, 2, "getValue")).toEqual({ line: 1, character: 9 });
  });

  it("prefers a whole-word match over a longer identifier", () => {
    expect(locateSymbol("const valueOf = value;", 1, "value")).toEqual({
      line: 0,
      character: 16,
    });
  });

  it("falls back to a partial match", () => {
    expect(locateSymbol(content, 3, "lueO")).toEqual({ line: 2, character: 19 });
  });

  it("rejects a line outside the file", () => {
    expect(() => locateSymbol(content, 9, "value")).toThrow("outside the file");
    expect(() => locateSymbol(content, 0, "value")).toThrow("outside the file");
  });

  it("rejects a symbol that is not on the line", () => {
    expect(() => locateSymbol(content, 4, "value")).toThrow("does not appear on line 4");
    expect(() => locateSymbol(content, 1, " ")).toThrow("symbol is required");
  });
});
