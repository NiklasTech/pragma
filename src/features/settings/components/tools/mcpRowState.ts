import type { AgentState } from "@/shared/components/ui/status-dot";

import type { McpServerStatus } from "../../hooks/useMcpServers";

export type McpRowKind = "running" | "starting" | "sign-in" | "failed" | "stopped";

export interface McpRowState {
  kind: McpRowKind;
  /** The state in words, shown next to the cell. */
  word: string;
  /** The square cell borrows the agent states; a failure has its own red. */
  cell: AgentState | "failed";
}

/** What one server row shows: a sign-in request wins over the error it came with. */
export function mcpRowState(
  status: McpServerStatus,
  authRequired: boolean,
  missingSecrets: boolean,
): McpRowState {
  if (authRequired) return { kind: "sign-in", word: "needs sign-in", cell: "needs-you" };
  switch (status) {
    case "running":
      return { kind: "running", word: "running", cell: "done" };
    case "starting":
      return { kind: "starting", word: "starting", cell: "working" };
    case "error":
      return { kind: "failed", word: "failed", cell: "failed" };
    case "stopped":
      return missingSecrets
        ? { kind: "sign-in", word: "needs secrets", cell: "needs-you" }
        : { kind: "stopped", word: "stopped", cell: "idle" };
  }
}
