import { type StateCreator } from "zustand";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isWorkspaceWindow } from "@/shared/lib/windowScope";

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

export function storeChannel(storeName: string, scope: string | null): string {
  return scope === null ? `pragma:store:${storeName}` : `pragma:store:${storeName}:${scope}`;
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

export function crossWindowSync<T extends object>(storeName: string, scope?: string) {
  const resolvedScope = scope ?? null;
  const channel = storeChannel(storeName, resolvedScope);

  return (config: StateCreator<T>): StateCreator<T> => {
    return (set, get, api) => {
      const state = config(set, get, api);

      if (!isTauri()) {
        return state;
      }

      let isRemote = false;
      let isReady = false;
      let lastState = get();

      void listen(channel, (event) => {
        const currentLabel = getWindowLabel();
        const payload = event.payload as { source: string; partial: Partial<T> };
        if (!currentLabel || payload.source === currentLabel) return;
        isRemote = true;
        set(payload.partial);
        isRemote = false;
      });

      void listen(`${channel}:snapshot`, (event) => {
        const currentLabel = getWindowLabel();
        const payload = event.payload as { source: string; state: T };
        if (!currentLabel || payload.source === currentLabel) return;
        isRemote = true;
        // Keep the local actions (functions) because the serialized snapshot
        // cannot transport functions and would otherwise wipe them out.
        const current = get();
        const actions: Partial<T> = {};
        for (const key of Object.keys(current) as Array<keyof T>) {
          if (typeof current[key] === "function") {
            actions[key] = current[key];
          }
        }
        set({ ...payload.state, ...actions } as T, true);
        isRemote = false;
        isReady = true;
      });

      api.subscribe((newState) => {
        const currentLabel = getWindowLabel();
        if (!currentLabel || lastState === undefined || isRemote || !isReady) {
          lastState = newState;
          if (isWorkspaceWindow()) {
            isReady = true;
          }
          return;
        }
        const diff = shallowDiff(lastState, newState);
        lastState = newState;
        if (diff) {
          void emit(channel, { source: currentLabel, partial: diff });
        }
      });

      return state;
    };
  };
}
