import { ShieldWarning } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";

interface ApprovalCardProps {
  title: string;
  detail?: string;
  description?: string;
  args?: unknown;
  onDeny: () => void;
  onAllow: () => void;
}

/// One pending permission request, shared by Pragma's agent and CLI agents.
export function ApprovalCard({
  title,
  detail,
  description,
  args,
  onDeny,
  onAllow,
}: ApprovalCardProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-status-warning/30 bg-status-warning/5 p-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <ShieldWarning size={16} weight="fill" className="mt-0.5 shrink-0 text-status-warning" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ui-sm font-medium text-fg-default">{title}</span>
          {detail && (
            <span className="truncate font-mono text-ui-xs text-fg-muted" title={detail}>
              {detail}
            </span>
          )}
          {description && <p className="text-ui-xs text-fg-muted">{description}</p>}
        </div>
      </div>
      {args !== undefined && args !== null && (
        <pre className="max-h-32 overflow-auto rounded-md border border-border-subtle bg-bg-root px-2.5 py-2 font-mono text-ui-2xs text-fg-muted">
          {JSON.stringify(args, null, 2)}
        </pre>
      )}
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="rounded-full px-3" onClick={onDeny}>
          Deny
        </Button>
        <Button size="sm" className="rounded-full px-3" onClick={onAllow}>
          Allow
        </Button>
      </div>
    </div>
  );
}
