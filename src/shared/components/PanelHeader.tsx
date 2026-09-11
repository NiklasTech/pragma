import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";

interface PanelHeaderProps {
  icon?: Icon;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PanelHeader({ icon: Icon, title, subtitle, actions, className }: PanelHeaderProps) {
  const hasText = Boolean(title || subtitle);

  if (!hasText && !actions) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 px-3",
        hasText ? "justify-between" : "justify-end",
        className,
      )}
    >
      {hasText && (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon size={13} weight="bold" className="shrink-0 text-fg-muted" />}
          <div className="flex min-w-0 flex-col">
            {title && <span className="truncate text-ui-sm font-semibold">{title}</span>}
            {subtitle && <span className="truncate text-ui-xs text-fg-subtle">{subtitle}</span>}
          </div>
        </div>
      )}
      {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
    </div>
  );
}
