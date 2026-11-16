import { describe, expect, it } from "vite-plus/test";

import { withoutSettingsWindows } from "./store";
import { createFloating, createPanel } from "./tree/operations";

describe("withoutSettingsWindows", () => {
  it("drops saved settings windows and keeps every other floating panel", () => {
    const bounds = { x: 0, y: 0, width: 400, height: 300 };
    const settings = createFloating(createPanel("settings"), bounds);
    const terminal = createFloating(createPanel("terminal"), bounds);
    expect(withoutSettingsWindows([settings, terminal])).toEqual([terminal]);
    expect(withoutSettingsWindows(undefined)).toEqual([]);
  });
});
