import { cn } from "@/shared/lib/utils";

export function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-4 shrink-0 items-center justify-center", className)}>
      <span className="absolute size-2.5 animate-ping rounded-full bg-primary/40 motion-reduce:animate-none" />
      <span className="relative size-1.5 rounded-full bg-linear-to-r from-brand-from to-brand-to" />
    </span>
  );
}
