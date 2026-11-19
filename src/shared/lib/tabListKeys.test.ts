import { describe, expect, it } from "vite-plus/test";

import { nextTabIndex } from "./tabListKeys";

describe("nextTabIndex", () => {
  it("moves with the arrows and wraps at both ends", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
  });

  it("jumps to the first and last tab", () => {
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
  });

  it("ignores other keys and empty lists", () => {
    expect(nextTabIndex("a", 0, 3)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
