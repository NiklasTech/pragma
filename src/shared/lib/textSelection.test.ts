import { describe, expect, it } from "vite-plus/test";
import { isSelectAllShortcut } from "./textSelection";

const keys = { key: "a", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe("isSelectAllShortcut", () => {
  it("matches Cmd+A on macOS and Ctrl+A elsewhere", () => {
    expect(isSelectAllShortcut({ ...keys, metaKey: true }, true)).toBe(true);
    expect(isSelectAllShortcut({ ...keys, ctrlKey: true }, false)).toBe(true);
    expect(isSelectAllShortcut({ ...keys, key: "A", metaKey: true }, true)).toBe(true);
  });

  it("ignores the other platform's modifier", () => {
    expect(isSelectAllShortcut({ ...keys, ctrlKey: true }, true)).toBe(false);
    expect(isSelectAllShortcut({ ...keys, metaKey: true }, false)).toBe(false);
  });

  it("ignores extra modifiers and other keys", () => {
    expect(isSelectAllShortcut({ ...keys, metaKey: true, shiftKey: true }, true)).toBe(false);
    expect(isSelectAllShortcut({ ...keys, metaKey: true, altKey: true }, true)).toBe(false);
    expect(isSelectAllShortcut({ ...keys, key: "s", metaKey: true }, true)).toBe(false);
    expect(isSelectAllShortcut(keys, true)).toBe(false);
  });
});
