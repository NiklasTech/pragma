import { stepLabel } from "@/features/agent/executor";
import { useAgentStore } from "@/features/agent/store";

import { resolveAcpApproval, useAcpApprovalsStore } from "../acp/acpApprovals";
import { resolveSpawnApproval, useSpawnApprovalsStore } from "../children/acpSpawn";

export interface FirstRequest {
  /** What the agent wants, for example the command it would run. */
  request: string;
  allow: () => void;
}

/** A tool title some CLIs wrap in backticks, without them. */
function plain(text: string): string {
  return text.replace(/^`(.*)`$/s, "$1");
}

/// The oldest permission request a session waits on, and how to allow it; null when none waits.
export function useFirstRequest(sessionId: string): FirstRequest | null {
  const acp = useAcpApprovalsStore((state) => state.bySession[sessionId]?.[0] ?? null);
  const spawn = useSpawnApprovalsStore((state) => state.bySession[sessionId]?.[0] ?? null);
  const agent = useAgentStore((state) =>
    state.runSessionId === sessionId ? (state.pendingApprovals[0] ?? null) : null,
  );
  const resolveAgent = useAgentStore((state) => state.resolveApproval);

  if (acp) {
    return {
      request: plain(acp.toolName),
      allow: () => void resolveAcpApproval(sessionId, acp.toolCallId, "allow"),
    };
  }
  // A question is answered with one of its options, not allowed.
  if (spawn && !spawn.options) {
    const { label, detail } = stepLabel(spawn.toolName, spawn.args);
    return {
      request: detail ?? label,
      allow: () => resolveSpawnApproval(sessionId, spawn.toolCallId, true),
    };
  }
  if (agent) {
    const { label, detail } = stepLabel(agent.toolName, agent.args);
    return { request: detail ?? label, allow: () => resolveAgent(agent.toolCallId, true) };
  }
  return null;
}
