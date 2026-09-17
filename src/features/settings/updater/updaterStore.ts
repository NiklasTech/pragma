import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { error as logError, info as logInfo } from "@tauri-apps/plugin-log";

export type UpdaterState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "up-to-date" }
  | { status: "available"; version: string; notes: string | null }
  | { status: "downloading"; version: string; progress: number }
  | { status: "ready-to-restart"; version: string }
  | { status: "error"; message: string; version: string | null };

interface UpdaterStore {
  state: UpdaterState;
  userRequested: boolean;
  checkForUpdates: (options?: { silent?: boolean }) => Promise<void>;
  acknowledgeCheck: () => void;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
}

let pendingUpdate: Update | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logUpdaterInfo(message: string): void {
  void logInfo(message).catch(() => {});
}

function logUpdaterError(message: string): void {
  void logError(message).catch(() => {});
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  state: { status: "idle" },
  userRequested: false,

  checkForUpdates: async (options) => {
    const silent = options?.silent ?? false;
    set({ state: { status: "checking" }, userRequested: !silent });
    try {
      const update = await check();
      pendingUpdate = update;
      if (update) {
        logUpdaterInfo(`update available: ${update.version}`);
        set({
          state: { status: "available", version: update.version, notes: update.body ?? null },
        });
      } else {
        set({ state: { status: "up-to-date" } });
      }
    } catch (error) {
      pendingUpdate = null;
      logUpdaterError(`update check failed: ${errorMessage(error)}`);
      if (silent) {
        set({ state: { status: "idle" }, userRequested: false });
      } else {
        set({ state: { status: "error", message: errorMessage(error), version: null } });
      }
    }
  },

  acknowledgeCheck: () => {
    set((current) => ({
      userRequested: false,
      state:
        current.state.status === "up-to-date" || current.state.status === "error"
          ? { status: "idle" }
          : current.state,
    }));
  },

  downloadAndInstall: async () => {
    const update = pendingUpdate;
    if (!update) return;
    const version = update.version;
    let downloaded = 0;
    let total = 0;
    set({ state: { status: "downloading", version, progress: 0 } });
    logUpdaterInfo(`update download started: ${version}`);
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
      logUpdaterInfo(`update download finished: ${version}`);
      set({ state: { status: "ready-to-restart", version } });
    } catch (error) {
      logUpdaterError(`update install failed (${version}): ${errorMessage(error)}`);
      set({ state: { status: "error", message: errorMessage(error), version } });
    }
  },

  restartApp: async () => {
    try {
      await relaunch();
    } catch (error) {
      const current = get().state;
      logUpdaterError(`update restart failed: ${errorMessage(error)}`);
      set({
        state: {
          status: "error",
          message: errorMessage(error),
          version: "version" in current ? current.version : null,
        },
      });
    }
  },
}));
