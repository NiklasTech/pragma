import { describe, expect, it } from "vite-plus/test";

import { splitFirstLine } from "./ghost-text-dom";

describe("ghost text hint position", () => {
  it("goes after the first line of a suggestion", () => {
    expect(splitFirstLine("value + 1;\n}\n")).toEqual(["value + 1;", "\n}\n"]);
    expect(splitFirstLine("\n  next")).toEqual(["", "\n  next"]);
  });

  it("goes at the end of a one-line suggestion", () => {
    expect(splitFirstLine("value + 1;")).toEqual(["value + 1;", ""]);
  });
});
