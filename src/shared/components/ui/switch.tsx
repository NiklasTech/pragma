import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/shared/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.75 transition-colors duration-(--motion-fast) ease-(--motion-ease) outline-none after:absolute after:-inset-x-2 after:-inset-y-1.5 focus-visible:ring-2 focus-visible:ring-border-focus aria-invalid:ring-2 aria-invalid:ring-destructive/40 data-[size=default]:h-5 data-[size=default]:w-8.5 data-[size=sm]:h-4 data-[size=sm]:w-7 data-checked:bg-fg-default data-unchecked:bg-control-hover data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full ring-0 transition-[translate,background-color] duration-(--motion-fast) ease-(--motion-ease-out) group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-2.5 data-checked:bg-bg-ground data-unchecked:bg-bg-elevated data-unchecked:shadow-[0_1px_2px_rgba(0,0,0,0.18)] dark:data-unchecked:bg-fg-muted dark:data-unchecked:shadow-none group-data-[size=default]/switch:data-checked:translate-x-3.5 group-data-[size=sm]/switch:data-checked:translate-x-3 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
