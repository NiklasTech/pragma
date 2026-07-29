import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdaterState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "up-to-date" }
  | { status: "available"; version: string; notes: string | null }
  | { status: "downloading"; version: string; progress: number }
  | { status: "ready-to-restart"; version: string }
  | { status: "error"; message: string };

interface UpdaterStore {
  state: UpdaterState;
  checkForUpdates: (options?: { silent?: boolean }) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
}

let pendingUpdate: Update | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useUpdaterStore = create<UpdaterStore>((set) => ({
  state: { status: "idle" },

  checkForUpdates: async (options) => {
    set({ state: { status: "checking" } });
    try {
      const update = await check();
      pendingUpdate = update;
      if (update) {
        set({
          state: { status: "available", version: update.version, notes: update.body ?? null },
        });
      } else {
        set({ state: { status: "up-to-date" } });
      }
    } catch (error) {
      pendingUpdate = null;
      if (options?.silent) {
        set({ state: { status: "idle" } });
      } else {
        set({ state: { status: "error", message: errorMessage(error) } });
      }
    }
  },

  downloadAndInstall: async () => {
    const update = pendingUpdate;
    if (!update) return;
    const version = update.version;
    let downloaded = 0;
    let total = 0;
    set({ state: { status: "downloading", version, progress: 0 } });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const progress = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
          set({ state: { status: "downloading", version, progress } });
        }
      });
      pendingUpdate = null;
      set({ state: { status: "ready-to-restart", version } });
    } catch (error) {
      set({ state: { status: "error", message: errorMessage(error) } });
    }
  },

  restartApp: async () => {
    try {
      await relaunch();
    } catch (error) {
      set({ state: { status: "error", message: errorMessage(error) } });
    }
  },
}));
