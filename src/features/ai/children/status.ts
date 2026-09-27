import type { AgentStatus } from "@/features/agent/store";
import type { ChatSession } from "@/shared/stores/ai";

import type { TerminalStatus } from "../terminal/runner";
import type { ThreadStatus } from "../threads/helpers";
import type { ChildRunStatus } from "./runStore";

export type ChildSessionStatus =
  | "running"
  | "needs-approval"
  | "done"
  | "error"
  | "stopped"
  | "exited"
  | "idle";

export const CHILD_STATUS_LABELS: Record<ChildSessionStatus, string> = {
  running: "Running",
  "needs-approval": "Needs approval",
  done: "Done",
  error: "Error",
  stopped: "Stopped",
  exited: "Exited",
  idle: "Idle",
};

const CHILD_RUN_STATUSES: Record<ChildRunStatus, ChildSessionStatus> = {
  running: "running",
  "waiting-approval": "needs-approval",
  done: "done",
  error: "error",
  cancelled: "stopped",
};

export function resolveChildStatus(
  session: Pick<ChatSession, "id" | "kind">,
  agentStatus: AgentStatus,
  runSessionId: string | null,
  terminalStatus: TerminalStatus | null,
  childRunStatus: ChildRunStatus | null = null,
): ChildSessionStatus {
  if (session.kind === "terminal") {
    if (terminalStatus === "running") return "running";
    if (terminalStatus === "exited") return "exited";
    if (terminalStatus === "cancelled") return "stopped";
    return "idle";
  }
  // A live turn in the focused chat wins over the background run that started the child.
  if (runSessionId !== session.id) {
    return childRunStatus ? CHILD_RUN_STATUSES[childRunStatus] : "idle";
  }

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

export function childThreadStatus(status: ChildSessionStatus): ThreadStatus {
  if (status === "running") return "running";
  if (status === "needs-approval") return "waiting-approval";
  if (status === "error") return "error";
  return "idle";
}
