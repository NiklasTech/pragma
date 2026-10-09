import { describe, expect, it } from "vite-plus/test";

import {
  addAlternative,
  MAX_ALTERNATIVES,
  nextLineChunk,
  nextWordChunk,
} from "./ghost-text-accept";

describe("partial accept", () => {
  it("takes the next word with its leading whitespace", () => {
    expect(nextWordChunk("  value + 1")).toBe("  value");
    expect(nextWordChunk("(a, b)")).toBe("(");
    expect(nextWordChunk("=> x")).toBe("=>");
    expect(nextWordChunk("   ")).toBe("   ");
  });

  it("takes the next line including its break", () => {
    expect(nextLineChunk("first\nsecond")).toBe("first\n");
    expect(nextLineChunk("\n  next\nlast")).toBe("\n  next\n");
    expect(nextLineChunk("only line")).toBe("only line");
  });
});

describe("alternatives", () => {
  it("shows a repeated suggestion instead of adding it", () => {
    expect(addAlternative(["a", "b"], "a")).toEqual({ suggestions: ["a", "b"], index: 0 });
  });

  it("adds a new one and keeps the list bounded", () => {
    expect(addAlternative(["a"], "b")).toEqual({ suggestions: ["a", "b"], index: 1 });
    const full = Array.from({ length: MAX_ALTERNATIVES }, (_, i) => `s${i}`);
    const result = addAlternative(full, "new");
    expect(result.suggestions).toHaveLength(MAX_ALTERNATIVES);
    expect(result.suggestions[result.index]).toBe("new");
  });
});
