import { cn } from "@/shared/lib/utils";

interface TitlebarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "danger";
}

export function TitlebarButton({ className, variant = "default", ...props }: TitlebarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md text-fg-muted outline-none",
        "transition-all duration-[var(--motion-base)] ease-[var(--motion-ease)]",
        "hover:bg-bg-hover hover:text-fg-default",
        "focus-visible:ring-2 focus-visible:ring-primary/40",
        "active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        variant === "danger" &&
          "hover:bg-status-error hover:text-fg-inverse focus-visible:ring-status-error/40",
        className,
      )}
      {...props}
    />
  );
}
