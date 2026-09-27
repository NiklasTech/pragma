import type { AgentStatus } from "@/features/agent/store";
import type { ChatSession } from "@/shared/stores/ai";

import type { TerminalStatus } from "../terminal/runner";

export type ChildSessionStatus =
  | "waiting"
  | "running"
  | "needs-approval"
  | "done"
  | "error"
  | "stopped"
  | "exited"
  | "idle";

export const CHILD_STATUS_LABELS: Record<ChildSessionStatus, string> = {
  waiting: "Starts when opened",
  running: "Running",
  "needs-approval": "Needs approval",
  done: "Done",
  error: "Error",
  stopped: "Stopped",
  exited: "Exited",
  idle: "Idle",
};

export function resolveChildStatus(
  session: Pick<ChatSession, "id" | "kind" | "pendingPrompt">,
  agentStatus: AgentStatus,
  runSessionId: string | null,
  terminalStatus: TerminalStatus | null,
): ChildSessionStatus {
  if (session.kind === "terminal") {
    if (terminalStatus === "running") return "running";
    if (terminalStatus === "exited") return "exited";
    if (terminalStatus === "cancelled") return "stopped";
    return "idle";
  }
  if (session.pendingPrompt) return "waiting";
  if (runSessionId !== session.id) return "idle";

  switch (agentStatus) {
    case "running":
      return "running";
    case "waiting-approval":
      return "needs-approval";
    case "done":
      return "done";
    case "error":
      return "error";
    case "cancelled":
      return "stopped";
    default:
      return "idle";
  }
}

export function isChildRunning(status: ChildSessionStatus): boolean {
  return status === "running" || status === "needs-approval";
}
