import { stepLabel } from "../executor";
import { useAgentStore } from "../store";
import { ApprovalBar } from "./ApprovalBar";

export function AgentApprovals({ takesEnter = false }: { takesEnter?: boolean }) {
  const pendingApprovals = useAgentStore((state) => state.pendingApprovals);
  const resolveApproval = useAgentStore((state) => state.resolveApproval);

  if (pendingApprovals.length === 0) return null;

  return (
    <div className="flex flex-col">
      {pendingApprovals.map((approval, index) => {
        const { label, detail } = stepLabel(approval.toolName, approval.args);
        return (
          <ApprovalBar
            key={approval.toolCallId}
            title={`Pragma wants to ${label.toLowerCase()}`}
            request={detail ?? JSON.stringify(approval.args ?? {})}
            description={approval.description}
            takesEnter={takesEnter && index === 0}
            onDeny={() => resolveApproval(approval.toolCallId, false)}
            onAllow={() => resolveApproval(approval.toolCallId, true)}
          />
        );
      })}
    </div>
  );
}
