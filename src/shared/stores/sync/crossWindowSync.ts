import { type StateCreator } from "zustand";

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

      let isRemote = false;
      let isReady = false;
      let currentLabel: string | null = null;
      let lastState = get();

      const init = async () => {
        const [{ emit, listen }, { getCurrentWindow }] = await Promise.all([
          import("@tauri-apps/api/event"),
          import("@tauri-apps/api/window"),
        ]);

        const win = getCurrentWindow();
        currentLabel = win.label;
        // The main window is authoritative from startup; external windows wait
        // for the initial snapshot before broadcasting their own changes.
        isReady = currentLabel === "main";

        await listen(`pragma:store:${storeName}`, (event) => {
          const payload = event.payload as { source: string; partial: Partial<T> };
          if (payload.source === currentLabel) return;
          isRemote = true;
          set(payload.partial);
          isRemote = false;
        });

        await listen(`pragma:store:${storeName}:snapshot`, (event) => {
          const payload = event.payload as { source: string; state: T };
          if (payload.source === currentLabel) return;
          isRemote = true;
          set(payload.state as T, true);
          isRemote = false;
          isReady = true;
        });

        api.subscribe((newState) => {
          if (isRemote || !isReady || !currentLabel) {
            lastState = newState;
            return;
          }
          const diff = shallowDiff(lastState, newState);
          lastState = newState;
          if (diff) {
            void emit(`pragma:store:${storeName}`, { source: currentLabel, partial: diff });
          }
        });
      };

      void init();
      return state;
    };
  };
}
