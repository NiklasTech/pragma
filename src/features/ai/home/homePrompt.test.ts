import { describe, expect, it } from "vite-plus/test";

import {
  HOME_PROMPT_EMPTY_LABEL,
  HOME_PROMPT_READY_LABEL,
  homePromptLabel,
  isHomePromptEmpty,
  isHomePromptSubmitKey,
  trimHomePrompt,
} from "./homePrompt";

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

describe("isHomePromptEmpty", () => {
  it("treats whitespace-only input as empty", () => {
    expect(isHomePromptEmpty("")).toBe(true);
    expect(isHomePromptEmpty(" \n\t ")).toBe(true);
    expect(isHomePromptEmpty("x")).toBe(false);
  });
});

describe("homePromptLabel", () => {
  it("shows New thread when empty or whitespace-only", () => {
    expect(homePromptLabel("")).toBe(HOME_PROMPT_EMPTY_LABEL);
    expect(homePromptLabel("   \n\t ")).toBe(HOME_PROMPT_EMPTY_LABEL);
    expect(HOME_PROMPT_EMPTY_LABEL).toBe("New thread");
  });

  it("shows Start when the trimmed text is non-empty", () => {
    expect(homePromptLabel("hi")).toBe(HOME_PROMPT_READY_LABEL);
    expect(HOME_PROMPT_READY_LABEL).toBe("Start");
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
