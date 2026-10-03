import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createThrottledJSONStorage } from "./throttledStorage";

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (name: string) => data.get(name) ?? null,
    setItem: vi.fn((name: string, value: string) => {
      data.set(name, value);
    }),
    removeItem: (name: string) => {
      data.delete(name);
    },
  };
}

describe("createThrottledJSONStorage", () => {
  let memory: ReturnType<typeof createMemoryStorage>;
  let fakeWindow: EventTarget;

  beforeEach(() => {
    vi.useFakeTimers();
    memory = createMemoryStorage();
    fakeWindow = new EventTarget();
    vi.stubGlobal("localStorage", memory);
    vi.stubGlobal("window", fakeWindow);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("writes only the latest value once per interval", () => {
    const storage = createThrottledJSONStorage<{ count: number }>(500);

    storage.setItem("key", { state: { count: 1 }, version: 0 });
    storage.setItem("key", { state: { count: 2 }, version: 0 });
    expect(memory.setItem).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(memory.setItem).toHaveBeenCalledTimes(1);
    expect(storage.getItem("key")).toEqual({ state: { count: 2 }, version: 0 });
  });

  it("writes pending values when the page is hidden", () => {
    const storage = createThrottledJSONStorage<{ count: number }>(500);

    storage.setItem("key", { state: { count: 3 }, version: 0 });
    fakeWindow.dispatchEvent(new Event("pagehide"));

    expect(memory.getItem("key")).toBe(JSON.stringify({ state: { count: 3 }, version: 0 }));
  });

  it("drops a pending value when the item is removed", () => {
    const storage = createThrottledJSONStorage<{ count: number }>(500);

    storage.setItem("key", { state: { count: 4 }, version: 0 });
    storage.removeItem("key");
    vi.advanceTimersByTime(500);

    expect(memory.getItem("key")).toBeNull();
  });
});
