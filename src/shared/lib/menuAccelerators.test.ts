import { describe, expect, it } from "vite-plus/test";

import { menuAccelerators, toMenuAccelerator } from "./menuAccelerators";
import { getDefaultShortcuts } from "./shortcuts";

describe("toMenuAccelerator", () => {
  it("joins the modifiers and the key code", () => {
    expect(toMenuAccelerator({ meta: true, shift: true, code: "KeyP" })).toBe("Cmd+Shift+KeyP");
    expect(toMenuAccelerator({ meta: true, alt: true, code: "KeyF" })).toBe("Cmd+Alt+KeyF");
    expect(toMenuAccelerator({ ctrl: true, code: "Backquote" })).toBe("Ctrl+Backquote");
    expect(toMenuAccelerator({ shift: true, code: "F5" })).toBe("Shift+F5");
  });

  it("falls back to the key and returns null without a binding", () => {
    expect(toMenuAccelerator({ ctrl: true, key: "Tab" })).toBe("Ctrl+Tab");
    expect(toMenuAccelerator(null)).toBeNull();
    expect(toMenuAccelerator({ meta: true })).toBeNull();
  });
});

describe("menuAccelerators", () => {
  it("maps every action of the shortcut settings", () => {
    const shortcuts = getDefaultShortcuts(true);
    const accelerators = menuAccelerators(shortcuts);
    expect(Object.keys(accelerators)).toEqual(Object.keys(shortcuts));
    expect(accelerators["view.toggleTerminal"]).toBe("Cmd+KeyJ");
    expect(accelerators["debug.attach"]).toBeNull();
  });
});
