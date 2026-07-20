import { CheckCircle } from "@phosphor-icons/react";

export function CleanTreeHint({ repoLabel }: { repoLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <div className="flex size-10 items-center justify-center rounded-full border border-status-success/20 bg-status-success/10 shadow-[0_0_24px_-6px_rgba(34,197,94,0.25)]">
        <CheckCircle size={18} weight="fill" className="text-status-success" />
      </div>
      <div>
        <div className="text-ui-sm font-medium text-fg-default">Working tree clean</div>
        <div className="text-ui-xs text-fg-muted">
          on <span className="font-mono text-fg-default/80">{repoLabel}</span>
        </div>
      </div>
    </div>
  );
}
