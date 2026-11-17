import { describe, expect, it } from "vite-plus/test";

import { terminalOutput } from "./useTerminalHeaderEvents";

function fakeTerm(lines: string[]) {
  return {
    buffer: {
      active: {
        length: lines.length,
        getLine: (index: number) => ({ translateToString: () => lines[index] ?? "" }),
      },
    },
  } as unknown as Parameters<typeof terminalOutput>[0];
}

describe("terminalOutput", () => {
  it("joins the buffer lines and drops the blank rows at the end", () => {
    expect(terminalOutput(fakeTerm(["$ ls", "a.ts  b.ts", "", ""]))).toBe("$ ls\na.ts  b.ts");
  });

  it("returns nothing for an empty terminal", () => {
    expect(terminalOutput(fakeTerm(["", ""]))).toBe("");
  });
});
