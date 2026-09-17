import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_CHAT_CONTEXT_SOURCES, type ChatContextSources } from "./autoContext";

export const CHAT_CONTEXT_SETTINGS_KEY = "pragma.chat.context.sources";

interface ChatContextSettingsState extends ChatContextSources {
  setSource: (source: keyof ChatContextSources, enabled: boolean) => void;
}

export const useChatContextSettings = create<ChatContextSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_CHAT_CONTEXT_SOURCES,
      setSource: (source, enabled) => {
        if (source === "activeFile") set({ activeFile: enabled });
        else if (source === "openTabs") set({ openTabs: enabled });
        else if (source === "gitDiff") set({ gitDiff: enabled });
        else set({ terminal: enabled });
      },
    }),
    { name: CHAT_CONTEXT_SETTINGS_KEY },
  ),
);

export function getChatContextSources(): ChatContextSources {
  const { activeFile, openTabs, gitDiff, terminal } = useChatContextSettings.getState();
  return { activeFile, openTabs, gitDiff, terminal };
}
