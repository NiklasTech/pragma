import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { unlistenQuietly } from "@/shared/lib/unlisten";
import { useAIStore } from "@/shared/stores/ai";

import { ACP_SESSION_INFO_EVENT, useAcpSessionInfoStore, type AcpSessionInfo } from "./sessionInfo";
import { useAcpSessionOptionsStore } from "./sessionOptions";

const EMPTY: AcpSessionInfo = { sessionId: "", commands: [], plan: [] };

/// Commands and plan of the active coding CLI session; empty when the chat does not run over ACP.
export function useAcpSessionInfo(acpActive: boolean): AcpSessionInfo {
  const chatSessionId = useAIStore((state) => state.activeChatSessionId);
  const started = useAcpSessionOptionsStore((state) =>
    chatSessionId ? state.bySession[chatSessionId] !== undefined : false,
  );
  const info = useAcpSessionInfoStore((state) =>
    chatSessionId ? state.bySession[chatSessionId] : undefined,
  );

  useEffect(() => {
    if (!acpActive || !started || !chatSessionId) return;
    void useAcpSessionInfoStore.getState().load(chatSessionId);
  }, [acpActive, chatSessionId, started]);

  const agentSessionId = info?.sessionId;
  useEffect(() => {
    if (!acpActive || !chatSessionId || !agentSessionId) return;
    const { chatSessions, updateChatSession } = useAIStore.getState();
    const session = chatSessions.find((item) => item.id === chatSessionId);
    if (!session || session.kind === "terminal" || session.cliSessionId === agentSessionId) return;
    void updateChatSession({
      ...session,
      cliSessionId: agentSessionId,
      updatedAt: Date.now(),
    }).catch(() => {});
  }, [acpActive, agentSessionId, chatSessionId]);

  useEffect(() => {
    if (!acpActive) return;
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      unlisten = await listen<{ chatSessionId: string; info: AcpSessionInfo }>(
        ACP_SESSION_INFO_EVENT,
        (event) =>
          useAcpSessionInfoStore
            .getState()
            .receive(event.payload.chatSessionId, event.payload.info),
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

  return acpActive && info ? info : EMPTY;
}
