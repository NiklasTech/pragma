import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./client", () => ({ lspDefinition: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { slicePeekLines } from "./peek";

describe("slicePeekLines", () => {
  it("returns a window around the target with one-based line numbers", () => {
    const slice = slicePeekLines("a\nb\nc\nd\ne", 2, 1);
    expect(slice.lines).toEqual([
      { number: 2, text: "b" },
      { number: 3, text: "c" },
      { number: 4, text: "d" },
    ]);
    expect(slice.highlightIndex).toBe(1);
  });

  it("clamps the window at the start of the file", () => {
    const slice = slicePeekLines("a\nb\nc\nd", 0, 2);
    expect(slice.lines.map((line) => line.number)).toEqual([1, 2, 3]);
    expect(slice.highlightIndex).toBe(0);
  });

  it("clamps the window at the end of the file", () => {
    const slice = slicePeekLines("a\nb\nc\nd", 3, 2);
    expect(slice.lines.map((line) => line.number)).toEqual([2, 3, 4]);
    expect(slice.highlightIndex).toBe(2);
  });

  it("clamps an out-of-range target line", () => {
    const slice = slicePeekLines("a\nb", 99, 1);
    expect(slice.lines[slice.lines.length - 1]?.number).toBe(2);
    expect(slice.lines[slice.highlightIndex].text).toBe("b");
  });

  it("handles empty content as a single line", () => {
    const slice = slicePeekLines("", 0, 4);
    expect(slice.lines).toEqual([{ number: 1, text: "" }]);
    expect(slice.highlightIndex).toBe(0);
  });
});
