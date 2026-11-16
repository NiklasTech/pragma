import { cn } from "@/shared/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-[17px] w-fit min-w-[17px] items-center justify-center gap-1 rounded-[3px] border border-fg-default/15 bg-transparent px-1 font-mono text-[10.5px] font-normal text-fg-subtle select-none in-data-[slot=button]:border-current/25 in-data-[slot=button]:text-current/75 in-data-[slot=tooltip-content]:bg-bg-surface/20 in-data-[slot=tooltip-content]:text-fg-default [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
