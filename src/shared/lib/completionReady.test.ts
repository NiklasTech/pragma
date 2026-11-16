import { describe, expect, it } from "vite-plus/test";

import { completionReady } from "./completionReady";

describe("completionReady", () => {
  it("runs Ollama without a key", () => {
    expect(completionReady("ollama", undefined, null, false)).toBe(true);
  });

  it("needs a URL for a custom endpoint", () => {
    expect(completionReady("custom", { baseUrl: "" }, null, false)).toBe(false);
    expect(completionReady("custom", { baseUrl: "http://localhost:8080" }, null, false)).toBe(true);
  });

  it("counts a GitHub sign-in for Copilot instead of a key", () => {
    expect(completionReady("copilot", undefined, null, true)).toBe(true);
    expect(completionReady("copilot", undefined, "stale", false)).toBe(false);
  });

  it("needs a stored key for every other provider", () => {
    expect(completionReady("anthropic", undefined, null, false)).toBe(false);
    expect(completionReady("anthropic", undefined, "sk-…abcd", false)).toBe(true);
  });
});
