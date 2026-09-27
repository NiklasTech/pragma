import { useEffect, useRef } from "react";

import { useAgentStore } from "@/features/agent/store";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { isPromptBlocked, usePendingPromptStore } from "./pendingPrompt";

interface PendingChildPromptOptions {
  rootPath: string;
  session: ChatSession | undefined;
  canSend: boolean;
  submitText: (text: string) => Promise<boolean>;
}

/// Sends a child conversation's first message once the child is shown and free to run.
export function usePendingChildPrompt({
  rootPath,
  session,
  canSend,
  submitText,
}: PendingChildPromptOptions): void {
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const forcedSessionId = usePendingPromptStore((state) => state.forcedSessionId);
  const sendingRef = useRef<string | null>(null);

  const sessionId = session?.id ?? null;
  const prompt = session?.pendingPrompt ?? null;

  useEffect(() => {
    if (!sessionId || !prompt || !canSend || sendingRef.current === sessionId) return;
    if (forcedSessionId !== sessionId && isPromptBlocked(sessionId, agentStatus, runSessionId)) {
      return;
    }

    sendingRef.current = sessionId;
    void submitText(prompt).then((sent) => {
      if (!sent) {
        sendingRef.current = null;
        return;
      }
      const current = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
      if (!current) return;
      const next = { ...current };
      delete next.pendingPrompt;
      void useAIStore.getState().updateChatSession(rootPath, next);
    });
  }, [
    agentStatus,
    canSend,
    forcedSessionId,
    prompt,
    rootPath,
    runSessionId,
    sessionId,
    submitText,
  ]);
}
