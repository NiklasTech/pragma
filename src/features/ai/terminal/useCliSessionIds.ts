import { useEffect } from "react";

import { useAIStore } from "@/shared/stores/ai";

import { subscribeTerminalCliSession } from "./runner";
import { isShellSession } from "./shell";

/// Stores the id of each CLI conversation with its session, so a restart can resume it.
export function useCliSessionIds(): void {
  useEffect(
    () =>
      subscribeTerminalCliSession((sessionId, cliSessionId) => {
        const { chatSessions, updateChatSession } = useAIStore.getState();
        const session = chatSessions.find((item) => item.id === sessionId);
        if (!session || isShellSession(session) || session.cliSessionId === cliSessionId) return;
        void updateChatSession({ ...session, cliSessionId, updatedAt: Date.now() }).catch(() => {});
      }),
    [],
  );
}
