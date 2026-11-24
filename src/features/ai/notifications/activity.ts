import type { AgentApproval, AgentStatus } from "@/features/agent/store";

import type { ChildRun } from "../children/runStore";

export type AttentionKind = "finished" | "failed" | "approval" | "input";

export interface ActivityInput {
  liveSessionId: string | null;
  /** Chats that answer while no pane shows them. */
  backgroundChats: readonly string[];
  agentStatus: AgentStatus;
  runSessionId: string | null;
  runs: Record<string, ChildRun>;
  spawnApprovals: Record<string, AgentApproval[]>;
  /** Permission requests from coding CLIs, by session. */
  acpApprovals: Record<string, readonly unknown[]>;
}

export interface SessionActivity {
  running: string[];
  waiting: string[];
}

/// Sessions with a live run, split by whether they wait for the user.
export function resolveSessionActivity(input: ActivityInput): SessionActivity {
  const waiting = new Set<string>();
  const running = new Set<string>();

  if (input.runSessionId) {
    if (input.agentStatus === "waiting-approval") waiting.add(input.runSessionId);
    else if (input.agentStatus === "running") running.add(input.runSessionId);
  }
  for (const [sessionId, run] of Object.entries(input.runs)) {
    if (run.status === "waiting-approval") waiting.add(sessionId);
    else if (run.status === "running") running.add(sessionId);
  }
  for (const approvals of [input.spawnApprovals, input.acpApprovals]) {
    for (const [sessionId, pending] of Object.entries(approvals)) {
      if (pending.length > 0) waiting.add(sessionId);
    }
  }
  if (input.liveSessionId) running.add(input.liveSessionId);
  for (const sessionId of input.backgroundChats) running.add(sessionId);

  return {
    running: [...running].filter((sessionId) => !waiting.has(sessionId)),
    waiting: [...waiting],
  };
}

/// Child runs that just finished or failed; a stopped run was the user's own doing.
export function childRunOutcomes(
  previous: Record<string, ChildRun>,
  next: Record<string, ChildRun>,
): Array<{ sessionId: string; kind: AttentionKind }> {
  const outcomes: Array<{ sessionId: string; kind: AttentionKind }> = [];
  for (const [sessionId, run] of Object.entries(next)) {
    const before = previous[sessionId];
    if (before?.status !== "running" && before?.status !== "waiting-approval") continue;
    if (run.status === "done") outcomes.push({ sessionId, kind: "finished" });
    else if (run.status === "error") outcomes.push({ sessionId, kind: "failed" });
  }
  return outcomes;
}

export function attentionMessage(
  kind: AttentionKind,
  title: string,
): { title: string; body: string } {
  switch (kind) {
    case "finished":
      return { title: "Session finished", body: `${title} is done.` };
    case "failed":
      return { title: "Session failed", body: `${title} stopped with an error.` };
    case "approval":
      return { title: "Approval needed", body: `${title} is waiting for your approval.` };
    case "input":
      return { title: "Input needed", body: `${title} is waiting for your input.` };
  }
}
