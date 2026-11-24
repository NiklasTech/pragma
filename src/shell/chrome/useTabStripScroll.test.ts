import { describe, expect, it } from "vite-plus/test";

import { revealOffset, wheelDistance } from "./useTabStripScroll";

const strip = { left: 200, right: 800 };

describe("revealOffset", () => {
  it("leaves a tab alone that is fully in view", () => {
    expect(revealOffset(strip, { left: 300, right: 380 })).toBe(0);
  });

  it("scrolls right to a tab beyond the end, with room for its close button", () => {
    expect(revealOffset(strip, { left: 1200, right: 1280 })).toBe(508);
  });

  it("scrolls back to a tab before the start", () => {
    expect(revealOffset(strip, { left: 100, right: 180 })).toBe(-128);
  });
});

describe("wheelDistance", () => {
  it("turns a mouse wheel into sideways scrolling", () => {
    expect(wheelDistance(0, 40)).toBe(40);
  });

  it("leaves sideways trackpad gestures to the browser", () => {
    expect(wheelDistance(30, 2)).toBe(0);
  });
});
