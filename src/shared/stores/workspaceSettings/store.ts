import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import type { WorkspaceSettings } from "./types";

interface WorkspaceSettingsState {
  rootPath: string | null;
  settings: WorkspaceSettings | null;
  error: string | null;
  load: (rootPath: string | null) => Promise<void>;
  save: (settings: WorkspaceSettings) => Promise<void>;
}

/// `.pragma/settings.json` of the workspace in this window; never synced to other windows.
export const useWorkspaceSettingsStore = create<WorkspaceSettingsState>()((set, get) => ({
  rootPath: null,
  settings: null,
  error: null,

  load: async (rootPath) => {
    if (get().rootPath !== rootPath) set({ rootPath, settings: null, error: null });
    if (!rootPath) return;
    try {
      const settings = await invoke<WorkspaceSettings | null>("workspace_settings_load", {
        rootPath,
      });
      if (get().rootPath === rootPath) set({ settings, error: null });
    } catch (err) {
      if (get().rootPath === rootPath) set({ error: String(err) });
    }
  },

  save: async (settings) => {
    const { rootPath } = get();
    if (!rootPath) throw new Error("No workspace is open");
    await invoke("workspace_settings_save", { rootPath, settings });
    set({ settings, error: null });
  },
}));
