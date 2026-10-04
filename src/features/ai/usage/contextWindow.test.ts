import { describe, expect, it } from "vite-plus/test";

import { contextLevel, resolveContextWindow } from "./contextWindow";
import { formatTokens } from "./formatTokens";

describe("resolveContextWindow", () => {
  it("prefers the size from the provider's model list", () => {
    const models = {
      models: [
        {
          id: "gpt-4o",
          name: "GPT-4o",
          context_window: 64_000,
          supports_streaming: true,
          supports_vision: true,
        },
      ],
      fetchedAt: 0,
    };
    expect(resolveContextWindow("gpt-4o", models)).toBe(64_000);
  });

  it("falls back to the model family", () => {
    expect(resolveContextWindow("claude-sonnet-4-5")).toBe(200_000);
    expect(resolveContextWindow("gpt-4.1-mini")).toBe(1_047_576);
    expect(resolveContextWindow("openai/o3")).toBe(200_000);
    expect(resolveContextWindow("gemini-2.5-pro")).toBe(1_048_576);
  });

  it("returns null for unknown or empty models", () => {
    expect(resolveContextWindow("llama3.2:latest")).toBeNull();
    expect(resolveContextWindow("")).toBeNull();
  });
});

describe("contextLevel", () => {
  it("warns near the limit", () => {
    expect(contextLevel(0.5)).toBe("normal");
    expect(contextLevel(0.8)).toBe("warning");
    expect(contextLevel(0.97)).toBe("critical");
  });
});

describe("formatTokens", () => {
  it("abbreviates large counts", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(1000)).toBe("1k");
    expect(formatTokens(1250)).toBe("1.3k");
    expect(formatTokens(48_400)).toBe("48k");
    expect(formatTokens(1_200_000)).toBe("1.2M");
  });
});
