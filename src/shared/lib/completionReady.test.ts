import { describe, expect, it } from "vite-plus/test";

import { completionReady } from "./completionReady";

describe("completionReady", () => {
  it("runs Ollama without a key", () => {
    expect(completionReady("ollama", undefined, null)).toBe(true);
  });

  it("needs a URL for a custom endpoint", () => {
    expect(completionReady("custom", { baseUrl: "" }, null)).toBe(false);
    expect(completionReady("custom", { baseUrl: "http://localhost:8080" }, null)).toBe(true);
  });

  it("needs a stored key for every other provider", () => {
    expect(completionReady("anthropic", undefined, null)).toBe(false);
    expect(completionReady("anthropic", undefined, "sk-…abcd")).toBe(true);
  });
});
