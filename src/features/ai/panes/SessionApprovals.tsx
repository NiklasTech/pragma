import { ApprovalBar } from "@/features/agent/components/ApprovalBar";
import { stepLabel } from "@/features/agent/executor";
import { useAIStore } from "@/shared/stores/ai";

import { resolveAcpApproval, useAcpApprovalsStore, type AcpApproval } from "../acp/acpApprovals";
import { ToolDiffList } from "../components/ToolDiff";
import { useSessionFolder } from "../components/useSessionFolder";
import { resolveSpawnApproval, useSpawnApprovalsStore } from "../children/acpSpawn";
import { sessionAgentManifest } from "../sessions/sessionAgent";

const NONE: never[] = [];

/** A request line from an ACP tool title, which some CLIs wrap in backticks. */
function requestText(toolName: string): string {
  return toolName.replace(/^`(.*)`$/s, "$1");
}

/** Diff lines per file a permission request shows before its buttons answer it. */
const APPROVAL_DIFF_LINES = 40;

function approvalDiffs(approval: AcpApproval) {
  return (approval.diffs ?? []).map((diff) => ({
    path: diff.path,
    oldText: diff.old_text,
    newText: diff.new_text,
  }));
}

export function useHasSessionApprovals(sessionId: string | null): boolean {
  const acp = useAcpApprovalsStore((state) =>
    sessionId ? (state.bySession[sessionId]?.length ?? 0) : 0,
  );
  const spawn = useSpawnApprovalsStore((state) =>
    sessionId ? (state.bySession[sessionId]?.length ?? 0) : 0,
  );
  return acp + spawn > 0;
}

/// The permission requests a session waits on, as bars at the bottom of its pane.
export function SessionApprovals({
  sessionId,
  takesEnter,
}: {
  sessionId: string;
  takesEnter: boolean;
}) {
  const acp = useAcpApprovalsStore((state) => state.bySession[sessionId] ?? NONE);
  const spawn = useSpawnApprovalsStore((state) => state.bySession[sessionId] ?? NONE);
  const agentName = useAIStore(
    (state) => sessionAgentManifest(state, sessionId)?.name ?? "The agent",
  );
  const root = useSessionFolder(sessionId);

  if (acp.length === 0 && spawn.length === 0) return null;

  return (
    <div className="flex flex-col">
      {acp.map((approval, index) => (
        <ApprovalBar
          key={approval.toolCallId}
          title={`${agentName} asks for permission`}
          request={requestText(approval.toolName)}
          description={typeof approval.args === "string" ? approval.args : approval.description}
          alwaysLabel={approval.alwaysLabel}
          takesEnter={takesEnter && index === 0}
          details={
            approval.diffs?.length ? (
              <ToolDiffList
                diffs={approvalDiffs(approval)}
                limit={APPROVAL_DIFF_LINES}
                root={root}
              />
            ) : undefined
          }
          onDeny={() => void resolveAcpApproval(sessionId, approval.toolCallId, "deny")}
          onAllow={() => void resolveAcpApproval(sessionId, approval.toolCallId, "allow")}
          onAllowAlways={() =>
            void resolveAcpApproval(sessionId, approval.toolCallId, "allow_always")
          }
        />
      ))}
      {spawn.map((approval, index) => {
        const { label, detail } = stepLabel(approval.toolName, approval.args);
        return (
          <ApprovalBar
            key={approval.toolCallId}
            title={`${agentName} wants to ${label.toLowerCase()}`}
            request={detail ?? label}
            description={approval.description}
            takesEnter={takesEnter && acp.length === 0 && index === 0}
            onDeny={() => resolveSpawnApproval(sessionId, approval.toolCallId, false)}
            onAllow={() => resolveSpawnApproval(sessionId, approval.toolCallId, true)}
          />
        );
      })}
    </div>
  );
}
