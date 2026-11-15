import { X } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";

interface QueuedMessageCardProps {
  text: string;
  onRemove: () => void;
}

export function QueuedMessageCard({ text, onRemove }: QueuedMessageCardProps) {
  return (
    <div className="mb-2 flex w-full items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2">
      <span className="shrink-0 text-ui-2xs font-semibold text-fg-subtle">Queued</span>
      <span className="min-w-0 flex-1 truncate text-ui-xs text-fg-muted" title={text}>
        {text}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label="Remove queued message"
        title="Remove queued message"
        className="rounded-full text-fg-subtle"
      >
        <X size={12} weight="bold" />
      </Button>
    </div>
  );
}
