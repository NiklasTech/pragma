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
        // Design D: a framed LED, a lit cell and the state in words.
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[5px] font-mono text-fg-subtle ring-1 ring-fg-default/15 ring-inset transition-[box-shadow,color] duration-(--motion-fast) ease-(--motion-ease) outline-none after:content-['Off'] hover:ring-fg-default/35 focus-visible:ring-2 focus-visible:ring-border-focus aria-invalid:ring-2 aria-invalid:ring-destructive/40 data-[size=default]:h-6 data-[size=default]:min-w-[52px] data-[size=default]:px-2 data-[size=default]:text-[11.5px] data-[size=sm]:h-5 data-[size=sm]:min-w-[44px] data-[size=sm]:px-1.5 data-[size=sm]:text-[10.5px] data-checked:text-fg-default data-checked:ring-primary/45 data-checked:after:content-['On'] data-disabled:cursor-not-allowed data-disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-2 shrink-0 rounded-[1.5px] bg-fg-default/20 transition-[background-color,box-shadow] duration-(--motion-fast) ease-(--motion-ease-out) data-checked:bg-primary data-checked:shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_70%,transparent)]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
