import { describe, expect, it } from "vite-plus/test";

import { appendTerminalBuffer, quoteShellPath } from "./buffer";

describe("quoteShellPath", () => {
  it("wraps a plain path in single quotes", () => {
    expect(quoteShellPath("/tmp/a.txt")).toBe("'/tmp/a.txt'");
  });

  it("keeps spaces inside the quotes", () => {
    expect(quoteShellPath("/tmp/my file.txt")).toBe("'/tmp/my file.txt'");
  });

  it("escapes embedded single quotes", () => {
    expect(quoteShellPath("/tmp/it's.txt")).toBe("'/tmp/it'\\''s.txt'");
  });
});

describe("appendTerminalBuffer", () => {
  it("appends while under the cap", () => {
    expect(appendTerminalBuffer("ab", "cd", 10)).toBe("abcd");
  });

  it("drops the oldest characters past the cap", () => {
    expect(appendTerminalBuffer("abcdef", "gh", 5)).toBe("defgh");
  });
});
