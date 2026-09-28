import { describe, expect, it } from "vite-plus/test";

import { levelFromSamples } from "./pcmCapture";

describe("levelFromSamples", () => {
  it("is zero for silence and empty buffers", () => {
    expect(levelFromSamples(new Float32Array(0))).toBe(0);
    expect(levelFromSamples(new Float32Array(512))).toBe(0);
  });

  it("rises with loudness and caps at one", () => {
    const quiet = levelFromSamples(new Float32Array(512).fill(0.02));
    const loud = levelFromSamples(new Float32Array(512).fill(0.2));
    expect(quiet).toBeGreaterThan(0.2);
    expect(loud).toBeGreaterThan(quiet);
    expect(levelFromSamples(new Float32Array(512).fill(1))).toBe(1);
  });
});
