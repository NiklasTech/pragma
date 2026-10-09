import { describe, expect, it } from "vite-plus/test";

import { parseNumberList, parsePositiveInt } from "./fields";

describe("project settings fields", () => {
  it("parses whole numbers within range", () => {
    expect(parsePositiveInt(" 4 ", 16)).toBe(4);
    expect(parsePositiveInt("", 16)).toBeUndefined();
    expect(parsePositiveInt("0", 16)).toBeUndefined();
    expect(parsePositiveInt("17", 16)).toBeUndefined();
    expect(parsePositiveInt("2.5", 16)).toBeUndefined();
  });

  it("parses comma separated columns and drops invalid ones", () => {
    expect(parseNumberList("80, 120, 80, x, 900", 500)).toEqual([80, 120]);
    expect(parseNumberList("", 500)).toBeUndefined();
  });
});
