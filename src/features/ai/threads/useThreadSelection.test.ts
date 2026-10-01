import { describe, expect, it } from "vite-plus/test";

import { rangeBetween } from "./useThreadSelection";

const ORDER = ["a", "b", "c", "d", "e"];

describe("rangeBetween", () => {
  it("selects from the anchor to the target in either direction", () => {
    expect(rangeBetween(ORDER, "b", "d")).toEqual(["b", "c", "d"]);
    expect(rangeBetween(ORDER, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("falls back to the target alone without a visible anchor", () => {
    expect(rangeBetween(ORDER, null, "c")).toEqual(["c"]);
    expect(rangeBetween(ORDER, "z", "c")).toEqual(["c"]);
  });

  it("ignores a target that is not visible", () => {
    expect(rangeBetween(ORDER, "a", "z")).toEqual([]);
  });
});
