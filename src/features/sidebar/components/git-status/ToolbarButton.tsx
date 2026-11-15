import { Button } from "@/shared/components/ui/button";
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
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      aria-label={label}
      className={cn("relative text-fg-subtle")}
    >
      {busy ? <Spinner size={14} className="animate-spin" /> : <Icon size={14} />}
      {badge !== undefined && badge !== null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-ui-2xs font-bold text-fg-inverse">
          {badge}
        </span>
      )}
    </Button>
  );
}
