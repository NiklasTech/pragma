import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { appendCapped, createRunOutputBatcher } from "./runOutput";

describe("appendCapped", () => {
  it("appends while below the limit", () => {
    expect(appendCapped(["a"], ["b", "c"], 5)).toEqual(["a", "b", "c"]);
  });

  it("drops the oldest lines beyond the limit", () => {
    expect(appendCapped(["a", "b", "c"], ["d", "e"], 4)).toEqual(["b", "c", "d", "e"]);
  });

  it("keeps only the newest incoming lines when they exceed the limit", () => {
    expect(appendCapped(["a"], ["b", "c", "d"], 2)).toEqual(["c", "d"]);
  });
});

describe("createRunOutputBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes queued lines per process in one batch", () => {
    const flush = vi.fn();
    const push = createRunOutputBatcher(flush);

    push("p1", "a");
    push("p2", "x");
    push("p1", "b");
    expect(flush).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenCalledWith("p1", ["a", "b"]);
    expect(flush).toHaveBeenCalledWith("p2", ["x"]);
  });

  it("starts a new batch after a flush", () => {
    const flush = vi.fn();
    const push = createRunOutputBatcher(flush);

    push("p1", "a");
    vi.runAllTimers();
    push("p1", "b");
    vi.runAllTimers();

    expect(flush).toHaveBeenNthCalledWith(2, "p1", ["b"]);
  });
});
