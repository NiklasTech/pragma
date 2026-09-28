import { describe, expect, it } from "vite-plus/test";

import { releasesBinding } from "./usePushToTalk";

function keyUp(key: string, code: string): KeyboardEvent {
  return { key, code } as KeyboardEvent;
}

describe("releasesBinding", () => {
  const binding = { alt: true, code: "Space" };

  it("ends the hold when the key or one of its modifiers is released", () => {
    expect(releasesBinding(keyUp(" ", "Space"), binding)).toBe(true);
    expect(releasesBinding(keyUp("Alt", "AltLeft"), binding)).toBe(true);
  });

  it("ignores keys that are not part of the shortcut", () => {
    expect(releasesBinding(keyUp("Shift", "ShiftLeft"), binding)).toBe(false);
    expect(releasesBinding(keyUp("a", "KeyA"), binding)).toBe(false);
  });

  it("matches key-based bindings by key", () => {
    expect(releasesBinding(keyUp("F8", "F8"), { key: "F8" })).toBe(true);
  });
});
