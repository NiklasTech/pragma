import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

interface TrustStatus {
  trusted: boolean | null;
}

interface FolderTrustState {
  /** The folder `trusted` belongs to. */
  rootPath: string | null;
  trusted: boolean;
  /** Loads the decision; `ask` shows the native prompt when the folder has none yet. */
  load: (rootPath: string | null, ask: boolean) => Promise<void>;
  /** Asks again in the native dialog and returns the new decision. */
  change: (rootPath: string) => Promise<boolean>;
}

/// Whether the open folder is trusted, decided once in a native dialog the webview cannot answer.
export const useFolderTrustStore = create<FolderTrustState>()((set, get) => ({
  rootPath: null,
  trusted: false,

  load: async (rootPath, ask) => {
    set({ rootPath, trusted: false });
    if (!rootPath) return;
    try {
      const trusted = ask
        ? await invoke<boolean>("workspace_trust_request", { rootPath })
        : (await invoke<TrustStatus>("workspace_trust_status", { rootPath })).trusted === true;
      if (get().rootPath === rootPath) set({ trusted });
    } catch {
      // Without a decision the folder stays untrusted.
    }
  },

  change: async (rootPath) => {
    const trusted = await invoke<boolean>("workspace_trust_change", { rootPath });
    if (get().rootPath === rootPath) set({ trusted });
    return trusted;
  },
}));

export function isFolderTrusted(rootPath: string | null): boolean {
  const state = useFolderTrustStore.getState();
  return rootPath !== null && state.rootPath === rootPath && state.trusted;
}
