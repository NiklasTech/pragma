import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { sessionCwd } from "@/features/ai/worktree/cwd";
import { isAcpActive } from "@/shared/lib/ai/acp";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";

import {
  ACP_CONFIG_OPTIONS_EVENT,
  useAcpSessionOptionsStore,
  type AcpConfigOption,
} from "./sessionOptions";

export interface CliSessionOptions {
  providerId: string;
  providerName: string;
  options: AcpConfigOption[];
  loading: boolean;
  error: string | null;
  setOption: (configId: string, value: string) => void;
}

/// Options of the active coding CLI session, or null when the chat does not run over ACP.
export function useCliSessionOptions(): CliSessionOptions | null {
  const activeCLIProvider = useAIStore((state) => state.activeCLIProvider);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const experimentalAcp = useSettingsStore((state) => state.experimental.acp);
  const rootPath = useFileExplorerStore((state) => state.rootPath);

  const acpActive = isAcpActive(cliManifests, activeCLIProvider, experimentalAcp);
  const session = chatSessions.find((item) => item.id === activeChatSessionId);
  const cwd = rootPath ? sessionCwd(session, rootPath) : null;

  const options = useAcpSessionOptionsStore((state) =>
    activeChatSessionId ? state.bySession[activeChatSessionId] : undefined,
  );
  const loading = useAcpSessionOptionsStore((state) =>
    activeChatSessionId ? (state.loading[activeChatSessionId] ?? false) : false,
  );
  const error = useAcpSessionOptionsStore((state) =>
    activeChatSessionId ? (state.errors[activeChatSessionId] ?? null) : null,
  );

  useEffect(() => {
    if (!acpActive || !activeCLIProvider || !activeChatSessionId || !cwd) return;
    void useAcpSessionOptionsStore.getState().load(activeCLIProvider, activeChatSessionId, cwd);
  }, [acpActive, activeCLIProvider, activeChatSessionId, cwd]);

  useEffect(() => {
    if (!acpActive) return;
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      unlisten = await listen<{ chatSessionId: string; options: AcpConfigOption[] }>(
        ACP_CONFIG_OPTIONS_EVENT,
        (event) =>
          useAcpSessionOptionsStore
            .getState()
            .receive(event.payload.chatSessionId, event.payload.options),
      );
      if (!active) {
        void unlistenQuietly(unlisten);
        unlisten = undefined;
      }
    })();

    return () => {
      active = false;
      void unlistenQuietly(unlisten);
    };
  }, [acpActive]);

  if (!acpActive || !activeCLIProvider || !activeChatSessionId) return null;

  return {
    providerId: activeCLIProvider,
    providerName:
      cliManifests.find((manifest) => manifest.id === activeCLIProvider)?.name ?? activeCLIProvider,
    options: options ?? [],
    loading,
    error,
    setOption: (configId, value) =>
      void useAcpSessionOptionsStore
        .getState()
        .setOption(activeCLIProvider, activeChatSessionId, configId, value),
  };
}
