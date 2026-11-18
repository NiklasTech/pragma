import type { AcpApproval } from "@/features/ai/acp/acpApprovals";
import type { AgentApproval } from "@/features/agent/store";
import type { AgentState } from "@/shared/components/ui/status-dot";

import type { RailEntry } from "../railEntries";

export type Question =
  | { kind: "acp"; entry: RailEntry; approval: AcpApproval }
  | { kind: "spawn"; entry: RailEntry; approval: AgentApproval }
  | { kind: "attention"; entry: RailEntry };

interface QuestionSources {
  acp: Record<string, AcpApproval[]>;
  spawn: Record<string, AgentApproval[]>;
  stateOf: (sessionId: string) => AgentState;
}

/// The question the command line shows: a permission it can answer, else an agent that needs you.
export function pickQuestion(
  entries: readonly RailEntry[],
  { acp, spawn, stateOf }: QuestionSources,
): Question | null {
  for (const entry of entries) {
    const approval = acp[entry.sessionId]?.[0];
    if (approval) return { kind: "acp", entry, approval };
  }
  for (const entry of entries) {
    const approval = spawn[entry.sessionId]?.[0];
    if (approval) return { kind: "spawn", entry, approval };
  }
  const waiting = entries.find((entry) => stateOf(entry.sessionId) === "needs-you");
  return waiting ? { kind: "attention", entry: waiting } : null;
}

/** A request line from an ACP tool title, which some CLIs wrap in backticks. */
export function requestText(toolName: string): string {
  return toolName.replace(/^`(.*)`$/s, "$1");
}
