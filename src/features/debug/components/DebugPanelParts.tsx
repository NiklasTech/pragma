import type { Icon } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";

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
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="text-fg-muted"
    >
      <Icon size={12} />
    </Button>
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
