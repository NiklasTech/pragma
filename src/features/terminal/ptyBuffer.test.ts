import { describe, expect, it } from "vite-plus/test";

import { appendTerminalBuffer } from "@/features/ai/terminal/buffer";
import { TailBuffer } from "./ptyBuffer";

describe("TailBuffer", () => {
  it("matches appendTerminalBuffer for any chunk sequence", () => {
    const limit = 50;
    const tail = new TailBuffer("", limit);
    let reference = "";
    for (let i = 0; i < 200; i++) {
      const chunk = "x".repeat(i % 17) + String(i);
      tail.append(chunk);
      reference = appendTerminalBuffer(reference, chunk, limit);
      if (i % 7 === 0) expect(tail.toString()).toBe(reference);
    }
    expect(tail.toString()).toBe(reference);
  });

  it("is cheaper than string concatenation at the default limit", () => {
    const chunk = "y".repeat(4096);
    const count = 3000;
    let t0 = performance.now();
    let s = "";
    for (let i = 0; i < count; i++) s = appendTerminalBuffer(s, chunk);
    const concatMs = performance.now() - t0;
    t0 = performance.now();
    const tail = new TailBuffer();
    for (let i = 0; i < count; i++) tail.append(chunk);
    const tailMs = performance.now() - t0;
    console.info(`concat ${concatMs.toFixed(1)}ms, tail ${tailMs.toFixed(1)}ms`);
    expect(tail.toString()).toBe(s);
    expect(tailMs).toBeLessThan(concatMs);
  });
});
