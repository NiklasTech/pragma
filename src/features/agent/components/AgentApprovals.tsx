import { stepLabel } from "../executor";
import { useAgentStore } from "../store";
import { ApprovalCard } from "./ApprovalCard";

export function AgentApprovals() {
  const pendingApprovals = useAgentStore((state) => state.pendingApprovals);
  const resolveApproval = useAgentStore((state) => state.resolveApproval);

  if (pendingApprovals.length === 0) return null;

  return (
    <div className="mb-2 flex flex-col gap-2">
      {pendingApprovals.map((approval) => {
        const { label, detail } = stepLabel(approval.toolName, approval.args);
        return (
          <ApprovalCard
            key={approval.toolCallId}
            title={`Allow: ${label}`}
            detail={detail}
            description={approval.description}
            args={detail ? undefined : approval.args}
            onDeny={() => resolveApproval(approval.toolCallId, false)}
            onAllow={() => resolveApproval(approval.toolCallId, true)}
          />
        );
      })}
    </div>
  );
}
