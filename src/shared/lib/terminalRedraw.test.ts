import { describe, expect, it } from "vite-plus/test";
import { forceTerminalRedraw, redrawSizes } from "./terminalRedraw";

describe("terminal redraw", () => {
  it("changes the size once and then restores it", () => {
    expect(redrawSizes(120, 40)).toEqual([
      { cols: 120, rows: 39 },
      { cols: 120, rows: 40 },
    ]);
  });

  it("grows instead of shrinking below two rows", () => {
    expect(redrawSizes(80, 2)).toEqual([
      { cols: 80, rows: 3 },
      { cols: 80, rows: 2 },
    ]);
  });

  it("resizes in order and ends at the real size", async () => {
    const calls: string[] = [];
    await forceTerminalRedraw(
      async (cols, rows) => {
        calls.push(`${cols}x${rows}`);
      },
      100,
      30,
    );
    expect(calls).toEqual(["100x29", "100x30"]);
  });
});
