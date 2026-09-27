import { X } from "@phosphor-icons/react";

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
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove queued message"
        title="Remove queued message"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}
