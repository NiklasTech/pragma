import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const clipboard = vi.hoisted(() => ({ copied: [] as string[], text: "pasted" }));
vi.mock("@/shared/lib/clipboard", () => ({
  copyToClipboard: async (text: string) => {
    clipboard.copied.push(text);
  },
  readFromClipboard: async () => clipboard.text,
}));
vi.mock("@/shared/stores/settings", () => ({
  useSettingsStore: {
    getState: () => ({ shortcuts: { "view.toggleTerminal": { meta: true, code: "KeyJ" } } }),
  },
}));

const { handleMacCliKey } = await import("./cliKeymap");

function keydown(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    type: "keydown",
    key,
    code: `Key${key.toUpperCase()}`,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...modifiers,
  } as unknown as KeyboardEvent;
}

function fakeTerminal(selection = "") {
  return {
    getSelection: vi.fn(() => selection),
    paste: vi.fn(),
    clear: vi.fn(),
    selectAll: vi.fn(),
  };
}

describe("handleMacCliKey", () => {
  beforeEach(() => {
    clipboard.copied = [];
  });

  it("sends line and word editing keys to the CLI", () => {
    const sent: string[] = [];
    const term = fakeTerminal();
    expect(
      handleMacCliKey(term, keydown("Backspace", { metaKey: true }), (d) => sent.push(d)),
    ).toBe(true);
    expect(handleMacCliKey(term, keydown("Backspace", { altKey: true }), (d) => sent.push(d))).toBe(
      true,
    );
    expect(handleMacCliKey(term, keydown("ArrowLeft", { altKey: true }), (d) => sent.push(d))).toBe(
      true,
    );
    expect(sent).toEqual(["\x15", "\x17", "\x1bb"]);
  });

  it("clears, selects all and copies the selection", () => {
    const term = fakeTerminal("hello");
    expect(handleMacCliKey(term, keydown("k", { metaKey: true }), () => {})).toBe(true);
    expect(handleMacCliKey(term, keydown("a", { metaKey: true }), () => {})).toBe(true);
    expect(handleMacCliKey(term, keydown("c", { metaKey: true }), () => {})).toBe(true);
    expect(term.clear).toHaveBeenCalledOnce();
    expect(term.selectAll).toHaveBeenCalledOnce();
    expect(clipboard.copied).toEqual(["hello"]);
  });

  it("pastes the clipboard through the terminal", async () => {
    const term = fakeTerminal();
    expect(handleMacCliKey(term, keydown("v", { metaKey: true }), () => {})).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(term.paste).toHaveBeenCalledWith("pasted");
  });

  it("leaves app shortcuts, plain keys and copy without a selection alone", () => {
    const term = fakeTerminal();
    expect(handleMacCliKey(term, keydown("j", { metaKey: true }), () => {})).toBe(false);
    expect(handleMacCliKey(term, keydown("x"), () => {})).toBe(false);
    expect(handleMacCliKey(term, keydown("c", { metaKey: true }), () => {})).toBe(false);
    const keyup = keydown("k", { metaKey: true, type: "keyup" });
    expect(handleMacCliKey(term, keyup, () => {})).toBe(false);
  });
});
