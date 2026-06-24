import { type StateCreator } from "zustand";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getWindowLabel(): string | null {
  try {
    return getCurrentWindow().label;
  } catch {
    return null;
  }
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

      let isRemote = false;
      let isReady = false;
      let lastState = get();

      void listen(`pragma:store:${storeName}`, (event) => {
        const currentLabel = getWindowLabel();
        const payload = event.payload as { source: string; partial: Partial<T> };
        if (!currentLabel || payload.source === currentLabel) return;
        isRemote = true;
        set(payload.partial);
        isRemote = false;
      });

      void listen(`pragma:store:${storeName}:snapshot`, (event) => {
        const currentLabel = getWindowLabel();
        const payload = event.payload as { source: string; state: T };
        // eslint-disable-next-line no-console
        console.log(`[crossWindowSync:${storeName}] snapshot received`, {
          currentLabel,
          source: payload.source,
          keys: Object.keys(payload.state as object),
        });
        if (!currentLabel || payload.source === currentLabel) return;
        isRemote = true;
        set(payload.state as T, true);
        isRemote = false;
        isReady = true;
      });

      api.subscribe((newState) => {
        const currentLabel = getWindowLabel();
        if (!currentLabel || lastState === undefined || isRemote || !isReady) {
          lastState = newState;
          if (currentLabel === "main") {
            isReady = true;
          }
          return;
        }
        const diff = shallowDiff(lastState, newState);
        lastState = newState;
        if (diff) {
          void emit(`pragma:store:${storeName}`, { source: currentLabel, partial: diff });
        }
      });

      return state;
    };
  };
}
