import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { useAcpSessionOptionsStore } from "@/features/ai/acp/sessionOptions";
import { isAcpActive } from "@/shared/lib/ai/acp";
import { pinnedSessionEngine, resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";
import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { imageInputSupport, type ImageInputSupport } from "./imageSupport";

/// Whether the engine of the active session accepts images, with the reason when it does not.
export function useImageInputSupport(): ImageInputSupport {
  const globalCLIProvider = useAIStore((state) => state.activeCLIProvider);
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const providers = useAIStore((state) => state.providers);
  const availableModels = useAIStore((state) => state.availableModels);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const activeChatSessionId = useAIStore((state) => state.activeChatSessionId);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const experimentalAcp = useSettingsStore((state) => state.experimental.acp);

  const session = chatSessions.find((item) => item.id === activeChatSessionId);
  const engine = resolveEffectiveEngine(pinnedSessionEngine(session), {
    activeCLIProvider: globalCLIProvider,
    activeProvider,
    activeModel,
    providers,
  });
  const acpActive = isAcpActive(cliManifests, engine.cliProviderId, experimentalAcp);

  // The ACP session starts while its options load; its capabilities are known afterwards.
  const optionsLoading = useAcpSessionOptionsStore((state) =>
    activeChatSessionId ? (state.loading[activeChatSessionId] ?? false) : false,
  );
  const options = useAcpSessionOptionsStore((state) =>
    activeChatSessionId ? state.bySession[activeChatSessionId] : undefined,
  );
  const [acpAccepts, setAcpAccepts] = useState<{ sessionId: string; accepts: boolean | null }>();

  useEffect(() => {
    if (!acpActive || !activeChatSessionId || optionsLoading) return;
    let active = true;
    invoke<boolean | null>("cli_acp_accepts_images", {
      req: { chat_session_id: activeChatSessionId },
    })
      .then((accepts) => {
        if (active) setAcpAccepts({ sessionId: activeChatSessionId, accepts });
      })
      .catch(() => {
        if (active) setAcpAccepts({ sessionId: activeChatSessionId, accepts: null });
      });
    return () => {
      active = false;
    };
  }, [acpActive, activeChatSessionId, optionsLoading, options]);

  return imageInputSupport({
    cliProviderId: engine.cliProviderId,
    acpActive,
    acpAcceptsImages: acpAccepts?.sessionId === activeChatSessionId ? acpAccepts.accepts : null,
    provider: engine.provider,
    model: engine.model,
    models: availableModels[engine.provider]?.models,
  });
}
