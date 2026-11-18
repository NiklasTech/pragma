import { describe, expect, it, vi } from "vite-plus/test";
import { guardedDispatch, wrapWithGuard } from "./menuAction";

describe("guardedDispatch", () => {
  it("runs once per id inside the dedupe window", () => {
    vi.useFakeTimers();
    const last = new Map<string, number>();
    const fn = vi.fn();

    guardedDispatch(last, "file.save", fn);
    guardedDispatch(last, "file.save", fn);

    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("runs again once the dedupe window elapsed", () => {
    vi.useFakeTimers();
    const last = new Map<string, number>();
    const fn = vi.fn();

    guardedDispatch(last, "file.save", fn);
    vi.advanceTimersByTime(81);
    guardedDispatch(last, "file.save", fn);

    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("tracks ids independently", () => {
    const last = new Map<string, number>();
    const first = vi.fn();
    const second = vi.fn();

    guardedDispatch(last, "file.save", first);
    guardedDispatch(last, "file.open", second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("wrapWithGuard", () => {
  it("dedupes the same action across two callers", () => {
    const last = new Map<string, number>();
    const save = vi.fn();
    const wrapped = wrapWithGuard({ "file.save": save }, last);

    wrapped["file.save"]?.();
    wrapped["file.save"]?.();

    expect(save).toHaveBeenCalledTimes(1);
  });
});
