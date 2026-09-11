import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";

interface PanelEmptyStateProps {
  icon: Icon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PanelEmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: PanelEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-4 py-8 text-center",
        className,
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-bg-elevated text-fg-muted">
        <Icon size={22} weight="bold" />
      </div>

      <h3 className="text-ui-md font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-[260px] text-ui-sm text-fg-muted">{description}</p>}

      {children && (
        <div className="mt-3 flex max-w-[280px] flex-wrap justify-center gap-2">{children}</div>
      )}
    </div>
  );
}
