import { type StateCreator } from "zustand";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function shallowDiff<T extends object>(prev: T, next: T): Partial<T> | null {
  const diff: Partial<T> = {};
  let changed = false;
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (prev[key] !== next[key]) {
      diff[key] = next[key];
      changed = true;
    }
  }
  return changed ? diff : null;
}

export function crossWindowSync<T extends object>(storeName: string) {
  return (config: StateCreator<T>): StateCreator<T> => {
    return (set, get, api) => {
      const state = config(set, get, api);

      if (!isTauri()) {
        return state;
      }

      const win = getCurrentWindow();
      const currentLabel = win.label;
      let isRemote = false;
      let isReady = currentLabel === "main";
      let lastState = get();

      void listen(`pragma:store:${storeName}`, (event) => {
        const payload = event.payload as { source: string; partial: Partial<T> };
        if (payload.source === currentLabel) return;
        isRemote = true;
        set(payload.partial);
        isRemote = false;
      });

      void listen(`pragma:store:${storeName}:snapshot`, (event) => {
        const payload = event.payload as { source: string; state: T };
        if (payload.source === currentLabel) return;
        isRemote = true;
        set(payload.state as T, true);
        isRemote = false;
        isReady = true;
      });

      api.subscribe((newState) => {
        if (lastState === undefined || isRemote || !isReady || !currentLabel) {
          lastState = newState;
          return;
        }
        const diff = shallowDiff(lastState, newState);
        lastState = newState;
        if (diff) {
          void emit(`pragma:store:${storeName}`, { source: currentLabel, partial: diff });
        }
      });

      if (currentLabel !== "main") {
        void emit("pragma:external:ready", { source: currentLabel, name: storeName });
      }

      return state;
    };
  };
}
