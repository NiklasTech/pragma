import { describe, expect, it } from "vite-plus/test";

import { isAgentOutput, TYPING_ECHO_MS } from "./activity";

describe("isAgentOutput", () => {
  it("ignores the echo right after a keystroke", () => {
    expect(isAgentOutput(1_000, 1_000 - TYPING_ECHO_MS + 1)).toBe(false);
  });

  it("counts output well after the last keystroke", () => {
    expect(isAgentOutput(5_000, 1_000)).toBe(true);
    expect(isAgentOutput(5_000, 0)).toBe(true);
  });
});
