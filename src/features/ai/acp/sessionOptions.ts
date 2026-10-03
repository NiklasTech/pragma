import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { sessionMcpServerIds } from "@/features/ai/mcp/selection";

export interface AcpConfigValue {
  value: string;
  name: string;
  description: string | null;
}

/// A select option a coding CLI reports over ACP, such as its model or reasoning effort.
export interface AcpConfigOption {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  currentValue: string;
  options: AcpConfigValue[];
}

export const ACP_CONFIG_OPTIONS_EVENT = "acp_config_options";

const CATEGORY_ORDER = ["model", "thought_level", "mode"];

export function sortConfigOptions(options: AcpConfigOption[]): AcpConfigOption[] {
  const rank = (option: AcpConfigOption) => {
    const index = CATEGORY_ORDER.indexOf(option.category ?? "");
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  return [...options].sort((a, b) => rank(a) - rank(b));
}

export function currentModelName(options: AcpConfigOption[]): string | null {
  const model = options.find((option) => option.category === "model");
  if (!model) return null;
  return (
    model.options.find((choice) => choice.value === model.currentValue)?.name ?? model.currentValue
  );
}

interface PreferenceState {
  preferred: Record<string, Record<string, string>>;
  remember: (providerId: string, configId: string, value: string) => void;
}

/// Last values picked per CLI, reapplied when a new session of that CLI starts.
export const useAcpPreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      preferred: {},
      remember: (providerId, configId, value) =>
        set((state) => ({
          preferred: {
            ...state.preferred,
            [providerId]: { ...state.preferred[providerId], [configId]: value },
          },
        })),
    }),
    { name: "pragma.agents.acp-preferences.v1" },
  ),
);

/// Remembered values that the session offers but does not use yet.
export function pendingPreferences(
  options: AcpConfigOption[],
  preferred: Record<string, string> | undefined,
): Array<{ configId: string; value: string }> {
  if (!preferred) return [];
  return Object.entries(preferred)
    .filter(([configId, value]) => {
      const option = options.find((item) => item.id === configId);
      return (
        option !== undefined &&
        option.currentValue !== value &&
        option.options.some((choice) => choice.value === value)
      );
    })
    .map(([configId, value]) => ({ configId, value }));
}

interface SessionOptionsState {
  bySession: Record<string, AcpConfigOption[]>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  receive: (chatSessionId: string, options: AcpConfigOption[]) => void;
  load: (
    providerId: string,
    chatSessionId: string,
    cwd: string,
    allowChildSessions: boolean,
  ) => Promise<void>;
  setOption: (
    providerId: string,
    chatSessionId: string,
    configId: string,
    value: string,
  ) => Promise<void>;
}

export const useAcpSessionOptionsStore = create<SessionOptionsState>()((set, get) => ({
  bySession: {},
  loading: {},
  errors: {},

  receive: (chatSessionId, options) =>
    set((state) => ({ bySession: { ...state.bySession, [chatSessionId]: options } })),

  load: async (providerId, chatSessionId, cwd, allowChildSessions) => {
    const state = get();
    if (state.loading[chatSessionId] || state.bySession[chatSessionId]) return;
    set((s) => ({
      loading: { ...s.loading, [chatSessionId]: true },
      errors: { ...s.errors, [chatSessionId]: null },
    }));

    try {
      let options = await invoke<AcpConfigOption[]>("cli_acp_session_config", {
        req: {
          provider_id: providerId,
          chat_session_id: chatSessionId,
          cwd,
          allow_child_sessions: allowChildSessions,
          mcp_server_ids: sessionMcpServerIds(chatSessionId) ?? undefined,
        },
      });
      const preferred = useAcpPreferenceStore.getState().preferred[providerId];
      for (const { configId, value } of pendingPreferences(options, preferred)) {
        options = await invoke<AcpConfigOption[]>("cli_acp_set_config_option", {
          req: { chat_session_id: chatSessionId, config_id: configId, value },
        });
      }
      get().receive(chatSessionId, options);
    } catch (err) {
      set((s) => ({ errors: { ...s.errors, [chatSessionId]: String(err) } }));
    } finally {
      set((s) => ({ loading: { ...s.loading, [chatSessionId]: false } }));
    }
  },

  setOption: async (providerId, chatSessionId, configId, value) => {
    try {
      const options = await invoke<AcpConfigOption[]>("cli_acp_set_config_option", {
        req: { chat_session_id: chatSessionId, config_id: configId, value },
      });
      get().receive(chatSessionId, options);
      useAcpPreferenceStore.getState().remember(providerId, configId, value);
    } catch (err) {
      set((s) => ({ errors: { ...s.errors, [chatSessionId]: String(err) } }));
    }
  },
}));
