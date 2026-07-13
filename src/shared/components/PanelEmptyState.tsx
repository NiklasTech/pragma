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
      <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10 shadow-[0_0_32px_-8px_var(--color-accent-glow)] sm:size-16">
        <Icon size={28} weight="fill" className="text-primary" />
      </div>

      <h3 className="text-ui-base font-semibold tracking-tight sm:text-ui-md">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-[280px] text-ui-sm text-fg-muted">{description}</p>
      )}

      {children && (
        <div className="mt-5 flex max-w-[320px] flex-wrap justify-center gap-2">{children}</div>
      )}
    </div>
  );
}
