import { describe, expect, it, vi } from "vite-plus/test";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";

import { fitEndedTerminal, shrunkFontSize } from "./endedTerminal";

describe("shrunkFontSize", () => {
  it("keeps the size when the columns fit", () => {
    expect(shrunkFontSize(13, 120, 94)).toBe(13);
  });

  it("shrinks until the columns fit", () => {
    expect(shrunkFontSize(13, 94, 149)).toBe(8.2);
  });

  it("stops at a readable size", () => {
    expect(shrunkFontSize(13, 40, 200)).toBe(8);
  });

  it("never enlarges a font that is already small", () => {
    expect(shrunkFontSize(6, 40, 200)).toBe(6);
  });
});

describe("fitEndedTerminal", () => {
  it("keeps the columns and takes the rows of the smaller font", () => {
    const term = { options: { fontSize: 10 }, resize: vi.fn() };
    const fit = {
      proposeDimensions: () =>
        term.options.fontSize === 13 ? { cols: 94, rows: 32 } : { cols: 149, rows: 51 },
    };
    fitEndedTerminal(term as unknown as Terminal, fit as unknown as FitAddon, 13, 149);
    expect(term.options.fontSize).toBe(8.2);
    expect(term.resize).toHaveBeenCalledWith(149, 51);
  });
});
