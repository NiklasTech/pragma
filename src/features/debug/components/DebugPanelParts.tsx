import type { Icon } from "@phosphor-icons/react";

export function ToolbarButton({
  icon: Icon,
  title,
  disabled,
  onClick,
}: {
  icon: Icon;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default disabled:opacity-40"
    >
      <Icon size={12} />
    </button>
  );
}

export function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-ui-xs font-semibold uppercase tracking-wider text-fg-muted">
        {title}
      </span>
      {count !== undefined && <span className="text-ui-xs text-fg-muted">{count}</span>}
    </div>
  );
}
