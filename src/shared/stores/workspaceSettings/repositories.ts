import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { useWorkspaceSettingsStore } from "./store";
import { useFolderTrustStore } from "./trust";
import type { WorkspaceSettings } from "./types";

interface TrustStatus {
  trusted: boolean | null;
}

interface RepositorySettings {
  settings: WorkspaceSettings | null;
  trusted: boolean;
}

interface RepositorySettingsState {
  byRoot: Record<string, RepositorySettings>;
  load: (rootPath: string) => Promise<void>;
  unload: (rootPath: string) => void;
}

/// Settings and trust of every open repository, so a session follows its own repository's rules.
export const useRepositorySettingsStore = create<RepositorySettingsState>()((set) => ({
  byRoot: {},

  load: async (rootPath) => {
    const [settings, trusted] = await Promise.all([
      invoke<WorkspaceSettings | null>("workspace_settings_load", { rootPath }).catch(() => null),
      invoke<TrustStatus>("workspace_trust_status", { rootPath })
        .then((status) => status.trusted === true)
        .catch(() => false),
    ]);
    set((state) => ({ byRoot: { ...state.byRoot, [rootPath]: { settings, trusted } } }));
  },

  unload: (rootPath) =>
    set((state) => {
      const byRoot = { ...state.byRoot };
      delete byRoot[rootPath];
      return { byRoot };
    }),
}));

/// The active repository reads the live stores; other repositories read their cached values.
export function repositoryWorkspaceSettings(rootPath: string): WorkspaceSettings | null {
  const active = useWorkspaceSettingsStore.getState();
  if (active.rootPath === rootPath) return active.settings;
  return useRepositorySettingsStore.getState().byRoot[rootPath]?.settings ?? null;
}

export function isRepositoryTrusted(rootPath: string): boolean {
  const active = useFolderTrustStore.getState();
  if (active.rootPath === rootPath) return active.trusted;
  return useRepositorySettingsStore.getState().byRoot[rootPath]?.trusted ?? false;
}
