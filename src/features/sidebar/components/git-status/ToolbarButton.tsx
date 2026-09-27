import { cn } from "@/shared/lib/utils";
import { Spinner } from "@phosphor-icons/react";

export function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  busy,
  disabled,
  badge,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  badge?: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      aria-label={label}
      className={cn(
        "relative flex size-7 items-center justify-center rounded-md text-fg-subtle transition-colors",
        disabled ? "opacity-40" : "hover:bg-bg-hover hover:text-fg-default",
      )}
    >
      {busy ? <Spinner size={14} className="animate-spin" /> : <Icon size={14} />}
      {badge !== undefined && badge !== null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-ui-2xs font-bold text-fg-inverse">
          {badge}
        </span>
      )}
    </button>
  );
}
