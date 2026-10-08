import { describe, expect, it } from "vite-plus/test";

import {
  findJumpTarget,
  MAX_OUTPUT_LINES,
  parseShellMark,
  readBufferText,
  readCommandOutput,
  readCommandText,
} from "./marks";

function bufferOf(rows: ReadonlyArray<string | { text: string; wrapped: true }>) {
  return {
    getLine: (index: number) => {
      const row = rows[index];
      if (row === undefined) return undefined;
      const text = typeof row === "string" ? row : row.text;
      return {
        isWrapped: typeof row !== "string",
        translateToString: (trimRight?: boolean, start = 0) => {
          const slice = text.slice(start);
          return trimRight ? slice.trimEnd() : slice;
        },
      };
    },
  } as unknown as Parameters<typeof readBufferText>[0];
}

describe("parseShellMark", () => {
  it("reads the four OSC 133 marks", () => {
    expect(parseShellMark("A")).toEqual({ kind: "promptStart" });
    expect(parseShellMark("A;click_events=1")).toEqual({ kind: "promptStart" });
    expect(parseShellMark("B")).toEqual({ kind: "inputStart" });
    expect(parseShellMark("C")).toEqual({ kind: "outputStart" });
    expect(parseShellMark("D;127")).toEqual({ kind: "commandEnd", exitCode: 127 });
  });

  it("keeps a missing or invalid exit code unknown and ignores other marks", () => {
    expect(parseShellMark("D")).toEqual({ kind: "commandEnd", exitCode: null });
    expect(parseShellMark("D;oops")).toEqual({ kind: "commandEnd", exitCode: null });
    expect(parseShellMark("P;k=i")).toBeNull();
  });
});

describe("buffer text", () => {
  const buffer = bufferOf([
    "~/repo % npm run very-long-scr",
    { text: "ipt-name   ", wrapped: true },
    "error: missing script",
    "",
    "  ",
  ]);

  it("joins wrapped rows and starts at the given column", () => {
    expect(readBufferText(buffer, 0, 9, 2)).toBe(
      "npm run very-long-script-name\nerror: missing script",
    );
  });

  it("reads the command between the input and output marks", () => {
    expect(readCommandText(buffer, 0, 9, 2)).toBe("npm run very-long-script-name");
    expect(readCommandText(buffer, 2, 7, 2)).toBe("missing script");
  });

  it("reads the output without trailing blank rows", () => {
    expect(readCommandOutput(buffer, 2, 4)).toBe("error: missing script");
  });

  it("keeps only the last output lines", () => {
    const rows = Array.from({ length: MAX_OUTPUT_LINES + 5 }, (_, index) => `line ${index}`);
    const output = readCommandOutput(bufferOf(rows), 0, rows.length - 1).split("\n");
    expect(output).toHaveLength(MAX_OUTPUT_LINES);
    expect(output[0]).toBe("line 5");
  });
});

describe("findJumpTarget", () => {
  const prompts = [2, 10, 30];

  it("finds the nearest prompt in either direction", () => {
    expect(findJumpTarget(prompts, 10, "previous")).toBe(2);
    expect(findJumpTarget(prompts, Number.POSITIVE_INFINITY, "previous")).toBe(30);
    expect(findJumpTarget(prompts, 10, "next")).toBe(30);
    expect(findJumpTarget(prompts, 0, "next")).toBe(2);
  });

  it("returns null past the first or last prompt", () => {
    expect(findJumpTarget(prompts, 2, "previous")).toBeNull();
    expect(findJumpTarget(prompts, 30, "next")).toBeNull();
    expect(findJumpTarget([], 5, "previous")).toBeNull();
  });
});
