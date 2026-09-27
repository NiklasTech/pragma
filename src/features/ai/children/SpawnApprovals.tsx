import { ApprovalCard } from "@/features/agent/components/ApprovalCard";
import { stepLabel } from "@/features/agent/executor";

import { resolveSpawnApproval, useSpawnApprovalsStore } from "./acpSpawn";

/// Child session requests a coding CLI made from this session.
export function SpawnApprovals({ sessionId }: { sessionId: string | null }) {
  const approvals = useSpawnApprovalsStore((state) =>
    sessionId ? state.bySession[sessionId] : undefined,
  );

  if (!sessionId || !approvals || approvals.length === 0) return null;

  return (
    <div className="mb-2 flex flex-col gap-2">
      {approvals.map((approval) => {
        const { label, detail } = stepLabel(approval.toolName, approval.args);
        return (
          <ApprovalCard
            key={approval.toolCallId}
            title={`Allow: ${label}`}
            detail={detail}
            description={approval.description}
            onDeny={() => resolveSpawnApproval(sessionId, approval.toolCallId, false)}
            onAllow={() => resolveSpawnApproval(sessionId, approval.toolCallId, true)}
          />
        );
      })}
    </div>
  );
}
