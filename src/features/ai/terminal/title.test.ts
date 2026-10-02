import { describe, expect, it } from "vite-plus/test";

import { isGeneratedTerminalTitle, terminalSessionTitle } from "./title";

describe("isGeneratedTerminalTitle", () => {
  it("recognizes the default title and batch suffixes", () => {
    const title = terminalSessionTitle("Claude Code", new Date(2026, 0, 1, 14, 32));

    expect(isGeneratedTerminalTitle(title, "Claude Code")).toBe(true);
    expect(isGeneratedTerminalTitle(`${title} #3`, "Claude Code")).toBe(true);
  });

  it("treats a renamed session as named", () => {
    expect(isGeneratedTerminalTitle("Backend refactor", "Claude Code")).toBe(false);
    expect(isGeneratedTerminalTitle("Claude Code review", "Claude Code")).toBe(false);
    expect(isGeneratedTerminalTitle("Codex 14:32", "Claude Code")).toBe(false);
  });
});
