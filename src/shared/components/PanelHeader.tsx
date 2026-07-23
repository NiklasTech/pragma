import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";

interface PanelHeaderProps {
  icon: Icon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PanelHeader({ icon: Icon, title, subtitle, actions, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-subtle sm:size-7 sm:rounded-lg">
          <Icon size={14} weight="bold" className="text-primary" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-ui-xs font-semibold sm:text-ui-sm">{title}</span>
          {subtitle && <span className="truncate text-ui-xs text-fg-subtle">{subtitle}</span>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
