import { describe, expect, it } from "vite-plus/test";

import { addStreamUsage } from "./usage";

describe("addStreamUsage", () => {
  it("sums every response and keeps the latest context size", () => {
    const first = addStreamUsage(undefined, {
      input_tokens: 1000,
      output_tokens: 200,
      cache_read_tokens: 800,
    });
    const second = addStreamUsage(first, {
      input_tokens: 1300,
      output_tokens: 50,
      cache_write_tokens: 100,
    });

    expect(second).toEqual({
      inputTokens: 2300,
      outputTokens: 250,
      cacheReadTokens: 800,
      cacheWriteTokens: 100,
      responses: 2,
      contextTokens: 1350,
    });
  });

  it("prefers the context fill an agent reports over the estimate", () => {
    const reported = addStreamUsage(undefined, { context_used: 64_000, context_size: 200_000 });
    const afterTurn = addStreamUsage(reported, { input_tokens: 500, output_tokens: 20 });

    expect(reported.responses).toBe(0);
    expect(afterTurn.contextTokens).toBe(64_000);
    expect(afterTurn.contextWindow).toBe(200_000);
    expect(afterTurn.inputTokens).toBe(500);
    expect(afterTurn.responses).toBe(1);
  });

  it("ignores chunks without token counts", () => {
    expect(addStreamUsage(undefined, {})).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      responses: 0,
    });
  });
});
