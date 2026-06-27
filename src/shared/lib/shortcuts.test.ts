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
    const shortcuts: ShortcutMap = {
      "file.open": { ctrl: true, code: "KeyO" },
      "file.save": { ctrl: true, code: "KeyS" },
      "file.closeTab": { ctrl: true, code: "KeyW" },
      "edit.editWithAI": { ctrl: true, code: "KeyL" },
      "view.toggleSidebar": { ctrl: true, code: "KeyB" },
      "view.toggleTerminal": { ctrl: true, shift: true, code: "KeyT" },
      "view.newTerminalTab": { ctrl: true, code: "KeyT" },
      "view.openSettings": { ctrl: true, code: "Comma" },
      "ai.toggle": { ctrl: true, shift: true, code: "KeyA" },
      "search.findInFiles": { ctrl: true, shift: true, code: "KeyF" },
      "chat.send": { key: "Enter" },
    };

    const conflict = findConflictingAction("file.open", { ctrl: true, code: "KeyS" }, shortcuts);
    expect(conflict).toBe("file.save");
  });

  it("ignores the action itself", () => {
    const shortcuts: ShortcutMap = {
      "file.open": { ctrl: true, code: "KeyO" },
      "file.save": { ctrl: true, code: "KeyS" },
      "file.closeTab": { ctrl: true, code: "KeyW" },
      "edit.editWithAI": { ctrl: true, code: "KeyL" },
      "view.toggleSidebar": { ctrl: true, code: "KeyB" },
      "view.toggleTerminal": { ctrl: true, shift: true, code: "KeyT" },
      "view.newTerminalTab": { ctrl: true, code: "KeyT" },
      "view.openSettings": { ctrl: true, code: "Comma" },
      "ai.toggle": { ctrl: true, shift: true, code: "KeyA" },
      "search.findInFiles": { ctrl: true, shift: true, code: "KeyF" },
      "chat.send": { key: "Enter" },
    };

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
  });

  it("contains all registered actions", () => {
    const defaults = getDefaultShortcuts(false);
    expect(Object.keys(defaults)).toHaveLength(11);
    expect(defaults["chat.send"]).toEqual({ key: "Enter" });
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
