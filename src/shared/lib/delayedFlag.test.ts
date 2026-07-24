import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createDelayedFlag } from "./delayedFlag";

describe("createDelayedFlag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not become visible before the delay elapses", () => {
    const changes: boolean[] = [];
    const flag = createDelayedFlag((v) => changes.push(v), 150);

    flag.update(true);
    vi.advanceTimersByTime(149);

    expect(changes).toEqual([]);
    flag.dispose();
  });

  it("becomes visible after the delay when still loading", () => {
    const changes: boolean[] = [];
    const flag = createDelayedFlag((v) => changes.push(v), 150);

    flag.update(true);
    vi.advanceTimersByTime(150);

    expect(changes).toEqual([true]);
    flag.dispose();
  });

  it("never becomes visible when loading finishes before the delay", () => {
    const changes: boolean[] = [];
    const flag = createDelayedFlag((v) => changes.push(v), 150);

    flag.update(true);
    vi.advanceTimersByTime(50);
    flag.update(false);
    vi.advanceTimersByTime(500);

    expect(changes).toEqual([]);
    flag.dispose();
  });

  it("resets to hidden when loading finishes after becoming visible", () => {
    const changes: boolean[] = [];
    const flag = createDelayedFlag((v) => changes.push(v), 150);

    flag.update(true);
    vi.advanceTimersByTime(150);
    flag.update(false);

    expect(changes).toEqual([true, false]);
    flag.dispose();
  });

  it("does not start a second timer when update(true) is called twice", () => {
    const changes: boolean[] = [];
    const flag = createDelayedFlag((v) => changes.push(v), 150);

    flag.update(true);
    vi.advanceTimersByTime(100);
    flag.update(true);
    vi.advanceTimersByTime(50);

    expect(changes).toEqual([true]);
    flag.dispose();
  });
});
