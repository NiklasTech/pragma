import { describe, expect, it } from "vite-plus/test";

import { parseKeybinding } from "./keybindingParse";

describe("parseKeybinding", () => {
  it("maps letters, digits and punctuation to codes", () => {
    expect(parseKeybinding("ctrl+shift+k", false)).toEqual({
      ctrl: true,
      shift: true,
      code: "KeyK",
    });
    expect(parseKeybinding("alt+1", false)).toEqual({ alt: true, code: "Digit1" });
    expect(parseKeybinding("cmd+/", true)).toEqual({ meta: true, code: "Slash" });
  });

  it("resolves mod per platform", () => {
    expect(parseKeybinding("mod+j", true)).toEqual({ meta: true, code: "KeyJ" });
    expect(parseKeybinding("mod+j", false)).toEqual({ ctrl: true, code: "KeyJ" });
  });

  it("accepts named and function keys", () => {
    expect(parseKeybinding("ctrl+enter", false)).toEqual({ ctrl: true, key: "Enter" });
    expect(parseKeybinding("f5", false)).toEqual({ key: "F5" });
    expect(parseKeybinding("shift+f12", false)).toEqual({ shift: true, key: "F12" });
  });

  it("rejects bindings that would break typing or are unknown", () => {
    expect(parseKeybinding("k", false)).toBeNull();
    expect(parseKeybinding("shift+k", false)).toBeNull();
    expect(parseKeybinding("ctrl+hyper+k", false)).toBeNull();
    expect(parseKeybinding("ctrl+", false)).toBeNull();
    expect(parseKeybinding("ctrl+unknownkey", false)).toBeNull();
  });
});
