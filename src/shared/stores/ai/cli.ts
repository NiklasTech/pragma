import { invoke } from "@tauri-apps/api/core";
import type { AIActions, AISlice, CLIManifest, CLIStatus } from "./types";

export const createCLISlice: AISlice<
  Pick<
    AIActions,
    | "loadCLIManifests"
    | "loadCLIStatuses"
    | "installCLI"
    | "startCLILogin"
    | "logoutCLI"
    | "setActiveCLIProvider"
  >
> = (set, get) => ({
  loadCLIManifests: async () => {
    const manifests = await invoke<CLIManifest[]>("cli_list_manifests");
    set({ cliManifests: manifests });
  },

  loadCLIStatuses: async () => {
    try {
      const statuses = await invoke<CLIStatus[]>("cli_check_all_statuses");
      const map: Record<string, CLIStatus> = {};
      for (const s of statuses) {
        map[s.provider_id] = s;
      }
      set({ cliStatuses: map });
    } catch {}
  },

  installCLI: async (providerId) => {
    await invoke("cli_install", { req: { provider_id: providerId } });
    await get().loadCLIStatuses();
  },

  startCLILogin: async (providerId) => {
    const result = await invoke<string>("cli_start_login", { req: { provider_id: providerId } });
    await get().loadCLIStatuses();
    return result;
  },

  logoutCLI: async (providerId) => {
    await invoke("cli_logout", { req: { provider_id: providerId } });
    await get().loadCLIStatuses();
  },

  setActiveCLIProvider: (providerId) => set({ activeCLIProvider: providerId }),
});
