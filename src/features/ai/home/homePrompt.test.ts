import { describe, expect, it } from "vite-plus/test";

import { isHomePromptSubmitKey, trimHomePrompt } from "./homePrompt";

describe("trimHomePrompt", () => {
  it("removes leading and trailing whitespace", () => {
    expect(trimHomePrompt("  hello  ")).toBe("hello");
    expect(trimHomePrompt("\n\nhello\n\n")).toBe("hello");
  });

  it("keeps internal blank lines", () => {
    expect(trimHomePrompt("first\n\n\nsecond")).toBe("first\n\n\nsecond");
    expect(trimHomePrompt("  first\n\nsecond  ")).toBe("first\n\nsecond");
  });
});

describe("isHomePromptSubmitKey", () => {
  it("submits on Enter", () => {
    expect(isHomePromptSubmitKey({ key: "Enter", shiftKey: false })).toBe(true);
  });

  it("inserts a newline on Shift+Enter", () => {
    expect(isHomePromptSubmitKey({ key: "Enter", shiftKey: true })).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isHomePromptSubmitKey({ key: "a", shiftKey: false })).toBe(false);
  });
});
