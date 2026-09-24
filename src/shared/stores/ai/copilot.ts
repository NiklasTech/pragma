import { invoke } from "@tauri-apps/api/core";
import type { AIActions, AISlice } from "./types";

export const createCopilotSlice: AISlice<
  Pick<
    AIActions,
    | "loadCopilotAuthStatus"
    | "startCopilotDeviceLogin"
    | "pollCopilotDeviceLogin"
    | "logoutCopilot"
    | "setCopilotClientId"
  >
> = (set, get) => ({
  loadCopilotAuthStatus: async () => {
    try {
      const status = await invoke<{ authenticated: boolean }>("copilot_auth_status");
      set({ copilotAuth: { ...get().copilotAuth, authenticated: status.authenticated } });
    } catch {}
  },

  startCopilotDeviceLogin: async (clientId) => {
    const result = await invoke<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    }>("copilot_start_device_login", { req: { client_id: clientId } });
    set({ copilotAuth: { ...get().copilotAuth, clientId } });
    return result;
  },

  pollCopilotDeviceLogin: async (clientId, deviceCode) => {
    const result = await invoke<{ authorized: boolean }>("copilot_poll_device_login", {
      req: { client_id: clientId, device_code: deviceCode },
    });
    if (result.authorized) {
      set({ copilotAuth: { ...get().copilotAuth, authenticated: true, clientId } });
    }
    return result.authorized;
  },

  logoutCopilot: async () => {
    await invoke("copilot_logout");
    set({ copilotAuth: { authenticated: false, clientId: get().copilotAuth.clientId } });
  },

  setCopilotClientId: (clientId) => {
    set({ copilotAuth: { ...get().copilotAuth, clientId } });
  },
});
