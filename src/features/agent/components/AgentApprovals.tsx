import { Check, X } from "@phosphor-icons/react";

import { useAgentStore } from "../store";

export function AgentApprovals() {
  const pendingApprovals = useAgentStore((state) => state.pendingApprovals);
  const resolveApproval = useAgentStore((state) => state.resolveApproval);

  if (pendingApprovals.length === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-2">
      {pendingApprovals.map((approval) => (
        <div
          key={approval.toolCallId}
          className="flex flex-col gap-2 rounded-lg border border-border bg-bg-root p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-ui-sm font-medium">Allow tool: {approval.toolName}</span>
          </div>
          {approval.description && (
            <p className="text-ui-xs text-fg-muted">{approval.description}</p>
          )}
          {approval.args ? (
            <pre className="max-h-32 overflow-auto rounded-md bg-bg-surface p-2 text-ui-xs text-fg-muted">
              {JSON.stringify(approval.args, null, 2)}
            </pre>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => resolveApproval(approval.toolCallId, false)}
              className="flex items-center gap-1 rounded-md bg-status-error px-3 py-1.5 text-ui-xs text-fg-inverse hover:bg-status-error/90"
            >
              <X size={12} weight="bold" />
              Deny
            </button>
            <button
              type="button"
              onClick={() => resolveApproval(approval.toolCallId, true)}
              className="flex items-center gap-1 rounded-md bg-status-success px-3 py-1.5 text-ui-xs text-fg-inverse hover:bg-status-success/90"
            >
              <Check size={12} weight="bold" />
              Allow
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
