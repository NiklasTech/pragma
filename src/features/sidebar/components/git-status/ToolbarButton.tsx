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
      className={cn(
        "relative flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors",
        disabled ? "opacity-40" : "hover:bg-bg-hover hover:text-fg-default",
      )}
    >
      {busy ? <Spinner size={14} className="animate-spin" /> : <Icon size={16} />}
      {badge !== undefined && badge !== null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-fg-inverse">
          {badge}
        </span>
      )}
    </button>
  );
}
