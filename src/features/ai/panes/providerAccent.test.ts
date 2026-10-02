import { describe, expect, it } from "vite-plus/test";

import { providerAccentById, seededAccent } from "./providerAccent";

describe("seededAccent", () => {
  it("returns the same accent for the same seed", () => {
    expect(seededAccent("agent-1")).toBe(seededAccent("agent-1"));
  });

  it("spreads different seeds across the palette", () => {
    const accents = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((seed) => seededAccent(seed).text),
    );
    expect(accents.size).toBeGreaterThan(2);
  });
});

describe("providerAccentById", () => {
  it("falls back to a neutral accent for unknown providers", () => {
    expect(providerAccentById("unknown").text).toBe("text-fg-default");
    expect(providerAccentById("anthropic-claude").text).toBe("text-brand-from");
  });
});
