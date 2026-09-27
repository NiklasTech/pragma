import { create } from "zustand";

import type { AgentStatus } from "@/features/agent/store";

interface PendingPromptState {
  forcedSessionId: string | null;
  forceStart: (sessionId: string) => void;
}

export const usePendingPromptStore = create<PendingPromptState>()((set) => ({
  forcedSessionId: null,
  forceStart: (sessionId) => set({ forcedSessionId: sessionId }),
}));

/// Another session's live run shares the single agent run, so a child waits for it unless forced.
export function isPromptBlocked(
  sessionId: string,
  agentStatus: AgentStatus,
  runSessionId: string | null,
): boolean {
  if (runSessionId === null || runSessionId === sessionId) return false;
  return agentStatus === "running" || agentStatus === "waiting-approval";
}
