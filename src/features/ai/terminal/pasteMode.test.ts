import { describe, expect, it } from "vite-plus/test";

import { bracketedPaste, nextPasteMode, PASTE_MODE_OFF } from "./pasteMode";

describe("nextPasteMode", () => {
  it("follows the program turning bracketed paste on and off", () => {
    const on = nextPasteMode(PASTE_MODE_OFF, "welcome\x1b[?2004h> ");
    expect(on.on).toBe(true);
    expect(nextPasteMode(on, "plain output").on).toBe(true);
    expect(nextPasteMode(on, "bye\x1b[?2004l").on).toBe(false);
  });

  it("takes the last switch within one chunk", () => {
    expect(nextPasteMode(PASTE_MODE_OFF, "\x1b[?2004l\x1b[?2004h").on).toBe(true);
    expect(nextPasteMode(PASTE_MODE_OFF, "\x1b[?2004h\x1b[?2004l").on).toBe(false);
  });

  it("sees a switch split across two chunks", () => {
    const first = nextPasteMode(PASTE_MODE_OFF, "prompt\x1b[?20");
    expect(first.on).toBe(false);
    expect(nextPasteMode(first, "04h").on).toBe(true);
  });
});

describe("bracketedPaste", () => {
  it("wraps the text in paste markers", () => {
    expect(bracketedPaste("a\nb")).toBe("\x1b[200~a\nb\x1b[201~");
  });
});
