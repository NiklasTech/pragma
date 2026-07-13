import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-full text-ui-base font-medium whitespace-nowrap transition-all duration-150 outline-none hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-accent-subtle data-[state=on]:bg-accent-subtle data-[state=on]:text-primary data-[state=on]:border data-[state=on]:border-primary/20 data-[state=on]:shadow-[0_0_16px_-4px_var(--color-accent-glow)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-transparent text-fg-subtle border border-transparent",
        outline: "border border-input/60 bg-transparent text-fg-subtle hover:bg-bg-hover",
        accent:
          "bg-transparent text-fg-subtle border border-transparent data-[state=on]:bg-accent-subtle data-[state=on]:text-primary data-[state=on]:border-primary/20",
      },
      size: {
        default:
          "h-7 min-w-7 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-6 min-w-6 px-1.5 text-ui-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-8 min-w-8 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
