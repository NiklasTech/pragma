import type { PersistStorage, StorageValue } from "zustand/middleware";

// localStorage persistence that serializes at most once per interval and on page hide.
export function createThrottledJSONStorage<S>(intervalMs: number): PersistStorage<S> {
  const pending = new Map<string, StorageValue<S>>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const writePending = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    for (const [name, value] of pending) {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        // Storage can be full or unavailable; the next write tries again.
      }
    }
    pending.clear();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", writePending);
  }

  return {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      return raw === null ? null : (JSON.parse(raw) as StorageValue<S>);
    },
    setItem: (name, value) => {
      pending.set(name, value);
      timer ??= setTimeout(writePending, intervalMs);
    },
    removeItem: (name) => {
      pending.delete(name);
      localStorage.removeItem(name);
    },
  };
}
