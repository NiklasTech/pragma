import { describe, expect, it } from "vite-plus/test";
import { parseRulers } from "./editor-rulers";

describe("parseRulers", () => {
  it("parses comma and space separated columns", () => {
    expect(parseRulers("80, 120")).toEqual([80, 120]);
    expect(parseRulers("100 80")).toEqual([80, 100]);
  });

  it("drops invalid, duplicate and out of range values", () => {
    expect(parseRulers("80, abc, 0, -4, 1.5, 80, 9999,")).toEqual([80]);
    expect(parseRulers("")).toEqual([]);
  });
});
