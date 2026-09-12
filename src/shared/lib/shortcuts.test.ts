import { describe, expect, it } from "vite-plus/test";
import {
  findConflictingAction,
  formatShortcut,
  getDefaultShortcuts,
  getIsMac,
  isConflict,
  isModifierKey,
  isValidBinding,
  matchShortcut,
  type ShortcutBinding,
  type ShortcutMap,
} from "./shortcuts";

function keyEvent(
  init: Partial<KeyboardEvent> & { key: string; code?: string },
): Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "key" | "code"> {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    code: init.key,
    ...init,
  };
}

describe("matchShortcut", () => {
  it("matches a simple ctrl+s shortcut by code", () => {
    const binding: ShortcutBinding = { ctrl: true, code: "KeyS" };
    expect(matchShortcut(keyEvent({ key: "s", code: "KeyS", ctrlKey: true }), binding)).toBe(true);
  });

  it("requires exact modifiers", () => {
    const binding: ShortcutBinding = { ctrl: true, code: "KeyS" };
    expect(
      matchShortcut(keyEvent({ key: "s", code: "KeyS", ctrlKey: true, shiftKey: true }), binding),
    ).toBe(false);
  });

  it("matches by key when no code is provided", () => {
    const binding: ShortcutBinding = { key: "Enter" };
    expect(matchShortcut(keyEvent({ key: "Enter", code: "Enter" }), binding)).toBe(true);
  });

  it("does not match when modifier is missing", () => {
    const binding: ShortcutBinding = { ctrl: true, code: "KeyO" };
    expect(matchShortcut(keyEvent({ key: "o", code: "KeyO" }), binding)).toBe(false);
  });

  it("matches mac cmd shortcut", () => {
    const binding: ShortcutBinding = { meta: true, code: "KeyO" };
    expect(matchShortcut(keyEvent({ key: "o", code: "KeyO", metaKey: true }), binding)).toBe(true);
  });
});

describe("isConflict", () => {
  it("detects identical bindings", () => {
    const a: ShortcutBinding = { ctrl: true, code: "KeyS" };
    const b: ShortcutBinding = { ctrl: true, code: "KeyS" };
    expect(isConflict(a, b)).toBe(true);
  });

  it("ignores falsy vs undefined modifiers", () => {
    const a: ShortcutBinding = { ctrl: true, code: "KeyS" };
    const b: ShortcutBinding = { ctrl: true, code: "KeyS", shift: false };
    expect(isConflict(a, b)).toBe(true);
  });

  it("detects code vs key conflicts for same physical key", () => {
    const a: ShortcutBinding = { ctrl: true, code: "KeyS" };
    const b: ShortcutBinding = { ctrl: true, key: "s" };
    expect(isConflict(a, b)).toBe(true);
  });

  it("does not conflict when modifiers differ", () => {
    const a: ShortcutBinding = { ctrl: true, code: "KeyS" };
    const b: ShortcutBinding = { ctrl: true, shift: true, code: "KeyS" };
    expect(isConflict(a, b)).toBe(false);
  });

  it("does not conflict with null bindings", () => {
    expect(isConflict({ ctrl: true, code: "KeyS" }, null)).toBe(false);
    expect(isConflict(null, { ctrl: true, code: "KeyS" })).toBe(false);
  });
});

describe("findConflictingAction", () => {
  it("finds a conflicting action id", () => {
    const shortcuts: ShortcutMap = getDefaultShortcuts(false);

    const conflict = findConflictingAction("file.open", { ctrl: true, code: "KeyS" }, shortcuts);
    expect(conflict).toBe("file.save");
  });

  it("ignores the action itself", () => {
    const shortcuts: ShortcutMap = getDefaultShortcuts(false);

    const conflict = findConflictingAction("file.save", { ctrl: true, code: "KeyS" }, shortcuts);
    expect(conflict).toBeNull();
  });
});

describe("formatShortcut", () => {
  it("formats mac cmd+s with symbols", () => {
    expect(formatShortcut({ meta: true, code: "KeyS" }, true)).toBe("⌘S");
  });

  it("formats non-mac ctrl+s with names", () => {
    expect(formatShortcut({ ctrl: true, code: "KeyS" }, false)).toBe("Ctrl+S");
  });

  it("formats enter without modifiers", () => {
    expect(formatShortcut({ key: "Enter" }, false)).toBe("Enter");
  });

  it("formats comma key", () => {
    expect(formatShortcut({ ctrl: true, code: "Comma" }, false)).toBe("Ctrl+,");
  });

  it("returns none for null binding", () => {
    expect(formatShortcut(null, false)).toBe("None");
  });
});

describe("getDefaultShortcuts", () => {
  it("uses ctrl on non-mac platforms", () => {
    const defaults = getDefaultShortcuts(false);
    expect(defaults["file.open"]).toEqual({ ctrl: true, code: "KeyO" });
    expect(defaults["ai.toggle"]).toEqual({ ctrl: true, shift: true, code: "KeyA" });
  });

  it("uses meta on mac platforms", () => {
    const defaults = getDefaultShortcuts(true);
    expect(defaults["file.open"]).toEqual({ meta: true, code: "KeyO" });
    expect(defaults["ai.toggle"]).toEqual({ meta: true, shift: true, code: "KeyA" });
    expect(defaults["view.splitEditor"]).toEqual({ meta: true, code: "Backslash" });
  });

  it("contains all registered actions", () => {
    const defaults = getDefaultShortcuts(false);
    expect(Object.keys(defaults)).toHaveLength(31);
    expect(defaults["chat.send"]).toEqual({ key: "Enter" });
    expect(defaults["view.commandPalette"]).toEqual({ ctrl: true, shift: true, code: "KeyP" });
    expect(defaults["view.toggleUiMode"]).toEqual({ ctrl: true, shift: true, code: "KeyE" });
    expect(defaults["file.goToFile"]).toEqual({ ctrl: true, code: "KeyP" });
    expect(defaults["search.find"]).toEqual({ ctrl: true, code: "KeyF" });
    expect(defaults["search.replace"]).toEqual({ ctrl: true, code: "KeyH" });
    expect(defaults["editor.formatDocument"]).toEqual({ shift: true, alt: true, code: "KeyF" });
    expect(defaults["tab.next"]).toEqual({ ctrl: true, key: "Tab" });
    expect(defaults["tab.prev"]).toEqual({ ctrl: true, shift: true, key: "Tab" });
    expect(defaults["view.splitEditor"]).toEqual({ ctrl: true, code: "Backslash" });
    expect(defaults["view.toggleProblems"]).toEqual({ ctrl: true, shift: true, code: "KeyM" });
    expect(defaults["view.togglePreview"]).toEqual({ ctrl: true, shift: true, code: "KeyV" });
    expect(defaults["debug.currentFile"]).toEqual({ code: "F5" });
    expect(defaults["debug.stop"]).toEqual({ shift: true, code: "F5" });
    expect(defaults["debug.stepOver"]).toEqual({ code: "F10" });
    expect(defaults["debug.stepInto"]).toEqual({ code: "F11" });
    expect(defaults["debug.stepOut"]).toEqual({ shift: true, code: "F11" });
    expect(defaults["debug.toggleBreakpoint"]).toEqual({ code: "F9" });
    expect(defaults["agent.toggle"]).toBeNull();
  });
});

describe("isModifierKey", () => {
  it("returns true for modifier keys", () => {
    expect(isModifierKey("Control")).toBe(true);
    expect(isModifierKey("Alt")).toBe(true);
    expect(isModifierKey("Shift")).toBe(true);
    expect(isModifierKey("Meta")).toBe(true);
  });

  it("returns false for normal keys", () => {
    expect(isModifierKey("Enter")).toBe(false);
    expect(isModifierKey("a")).toBe(false);
  });
});

describe("isValidBinding", () => {
  it("accepts a binding with code", () => {
    expect(isValidBinding({ ctrl: true, code: "KeyS" })).toBe(true);
  });

  it("accepts a binding with key", () => {
    expect(isValidBinding({ key: "Enter" })).toBe(true);
  });

  it("rejects pure modifier key binding", () => {
    expect(isValidBinding({ key: "Control" })).toBe(false);
  });

  it("rejects empty binding", () => {
    expect(isValidBinding({})).toBe(false);
    expect(isValidBinding(null)).toBe(false);
  });
});

describe("getIsMac", () => {
  it("returns a boolean", () => {
    expect(typeof getIsMac()).toBe("boolean");
  });
});
