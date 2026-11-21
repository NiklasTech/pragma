import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(async (_command: string, _args: { id: string }) => ["claude"]),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("./runner", () => ({ getTerminalPtyId: (sessionId: string) => `pty-${sessionId}` }));

import { FOREGROUND_POLL_MS, useForegroundStore, watchForeground } from "./foregroundPoller";

describe("watchForeground", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks a shell once per tick however many watch it", async () => {
    const stopA = watchForeground("shell-1");
    const stopB = watchForeground("shell-1");
    await vi.advanceTimersByTimeAsync(0);
    invokeMock.mockClear();

    await vi.advanceTimersByTimeAsync(FOREGROUND_POLL_MS * 3);

    expect(invokeMock).toHaveBeenCalledTimes(3);
    expect(useForegroundStore.getState().names["shell-1"]).toEqual(["claude"]);
    stopA();
    stopB();
  });

  it("keeps checking while one watcher is left and stops after the last", async () => {
    const stopA = watchForeground("shell-1");
    const stopB = watchForeground("shell-1");
    await vi.advanceTimersByTimeAsync(0);

    stopA();
    invokeMock.mockClear();
    await vi.advanceTimersByTimeAsync(FOREGROUND_POLL_MS);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    stopB();
    invokeMock.mockClear();
    await vi.advanceTimersByTimeAsync(FOREGROUND_POLL_MS * 3);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(useForegroundStore.getState().names["shell-1"]).toBeUndefined();
  });

  it("does not notify subscribers when the foreground program stays the same", async () => {
    const stop = watchForeground("shell-1");
    await vi.advanceTimersByTimeAsync(0);
    const updates = vi.fn();
    const unsubscribe = useForegroundStore.subscribe(updates);

    await vi.advanceTimersByTimeAsync(FOREGROUND_POLL_MS * 3);

    expect(updates).not.toHaveBeenCalled();
    unsubscribe();
    stop();
  });
});
