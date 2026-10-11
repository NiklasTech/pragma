import { describe, expect, it } from "vite-plus/test";
import { macTerminalKeyAction } from "./terminalKeymap";

function keyEvent(
  key: string,
  modifiers: { meta?: boolean; alt?: boolean; ctrl?: boolean; shift?: boolean },
) {
  return {
    key,
    metaKey: !!modifiers.meta,
    altKey: !!modifiers.alt,
    ctrlKey: !!modifiers.ctrl,
    shiftKey: !!modifiers.shift,
  };
}

describe("macTerminalKeyAction", () => {
  it("maps Cmd shortcuts to terminal actions", () => {
    expect(macTerminalKeyAction(keyEvent("k", { meta: true }))).toEqual({ type: "clear" });
    expect(macTerminalKeyAction(keyEvent("c", { meta: true }))).toEqual({ type: "copy" });
    expect(macTerminalKeyAction(keyEvent("v", { meta: true }))).toEqual({ type: "paste" });
    expect(macTerminalKeyAction(keyEvent("a", { meta: true }))).toEqual({ type: "selectAll" });
  });

  it("maps Cmd navigation to line control sequences", () => {
    expect(macTerminalKeyAction(keyEvent("ArrowLeft", { meta: true }))).toEqual({
      type: "send",
      data: "\x01",
    });
    expect(macTerminalKeyAction(keyEvent("ArrowRight", { meta: true }))).toEqual({
      type: "send",
      data: "\x05",
    });
    expect(macTerminalKeyAction(keyEvent("Backspace", { meta: true }))).toEqual({
      type: "send",
      data: "\x15",
    });
  });

  it("maps Option navigation to word control sequences", () => {
    expect(macTerminalKeyAction(keyEvent("ArrowLeft", { alt: true }))).toEqual({
      type: "send",
      data: "\x1bb",
    });
    expect(macTerminalKeyAction(keyEvent("ArrowRight", { alt: true }))).toEqual({
      type: "send",
      data: "\x1bf",
    });
    expect(macTerminalKeyAction(keyEvent("Backspace", { alt: true }))).toEqual({
      type: "send",
      data: "\x17",
    });
  });

  it("matches letters regardless of Caps Lock", () => {
    expect(macTerminalKeyAction(keyEvent("K", { meta: true }))).toEqual({ type: "clear" });
  });

  it("ignores other modifier combinations and unmapped keys", () => {
    expect(macTerminalKeyAction(keyEvent("k", {}))).toBeNull();
    expect(macTerminalKeyAction(keyEvent("c", { ctrl: true }))).toBeNull();
    expect(macTerminalKeyAction(keyEvent("k", { meta: true, shift: true }))).toBeNull();
    expect(macTerminalKeyAction(keyEvent("ArrowLeft", { meta: true, alt: true }))).toBeNull();
    expect(macTerminalKeyAction(keyEvent("k", { alt: true }))).toBeNull();
    expect(macTerminalKeyAction(keyEvent("x", { meta: true }))).toBeNull();
  });
});
