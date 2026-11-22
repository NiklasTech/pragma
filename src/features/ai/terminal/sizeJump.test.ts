import { describe, expect, it } from "vite-plus/test";

import { isSizeJump } from "./sizeJump";

describe("isSizeJump", () => {
  it("treats a zoom in or out as a jump", () => {
    expect(isSizeJump({ width: 400, height: 300 }, 1600, 900)).toBe(true);
    expect(isSizeJump({ width: 1600, height: 900 }, 400, 300)).toBe(true);
  });

  it("leaves small drags and unknown sizes to the debounce", () => {
    expect(isSizeJump({ width: 400, height: 300 }, 420, 310)).toBe(false);
    expect(isSizeJump(undefined, 1600, 900)).toBe(false);
    expect(isSizeJump({ width: 0, height: 0 }, 1600, 900)).toBe(false);
  });
});
