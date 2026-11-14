import type { AgentState } from "@/shared/components/ui/status-dot";
import type { AgentStatus } from "@/features/agent/store";

const AGENT_STATES: Record<AgentStatus, AgentState> = {
  idle: "idle",
  running: "working",
  "waiting-approval": "needs-you",
  done: "done",
  error: "needs-you",
  cancelled: "idle",
};

/** The state a built-in agent pane shows in its status dot. */
export function agentPaneState(status: AgentStatus): AgentState {
  return AGENT_STATES[status];
}

export interface TerminalPaneStatus {
  status: "running" | "exited" | "cancelled";
  exitCode: number | null;
  /** Output arrived recently. */
  active: boolean;
}

/** A CLI terminal works while it prints, is done while it waits and needs you after a failure. */
export function terminalPaneState({ status, exitCode, active }: TerminalPaneStatus): AgentState {
  if (status === "running") return active ? "working" : "done";
  if (status === "exited" && exitCode !== null && exitCode !== 0) return "needs-you";
  return "idle";
}

/** The status dot's tooltip for a terminal pane. */
export function terminalPaneLabel({ status, exitCode, active }: TerminalPaneStatus): string {
  if (status === "running") return active ? "Working" : "Waiting for input";
  if (status === "cancelled") return "Stopped";
  return exitCode !== null ? `Exited (${exitCode})` : "Exited";
}
