import type { AgentStatus } from "@/features/agent/store";
import type { ChatSession } from "@/shared/stores/ai";

import type { TerminalStatus } from "../terminal/runner";
import { resolveThreadStatus } from "../threads/helpers";

export interface SessionCloseTarget {
  sessionId: string | null;
  title: string;
  kind: ChatSession["kind"];
  terminalStatus: TerminalStatus | null;
}

export interface CloseConfirm {
  title: string;
  body: string;
}

export function isSessionTabLive(
  target: SessionCloseTarget,
  agentStatus: AgentStatus,
  runSessionId: string | null,
): boolean {
  if (target.sessionId === null) return false;
  if (target.kind === "terminal") return target.terminalStatus === "running";

  const status = resolveThreadStatus(agentStatus, target.sessionId, runSessionId);
  return status === "running" || status === "waiting-approval";
}

export function buildCloseConfirm(
  targets: SessionCloseTarget[],
  agentStatus: AgentStatus,
  runSessionId: string | null,
): CloseConfirm | null {
  const live = targets.filter((target) => isSessionTabLive(target, agentStatus, runSessionId));
  if (live.length === 0) return null;

  if (live.length > 1) {
    return {
      title: "Close running sessions?",
      body: `${live.length} tabs still have a running session. A terminal keeps running. A conversation turn stops.`,
    };
  }

  const [target] = live;
  if (target.kind === "terminal") {
    return {
      title: "Close running terminal?",
      body: `${target.title} is still running. Closing the tab leaves the process running. The session can be opened again from the list.`,
    };
  }

  return {
    title: "Close running session?",
    body: `${target.title} is still working. Closing the tab stops this turn.`,
  };
}
