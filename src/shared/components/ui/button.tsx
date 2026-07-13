import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-ui-base font-medium whitespace-nowrap transition-all duration-base outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-root active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-35 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_8px_-2px_var(--color-accent-glow)] hover:bg-primary/85 hover:shadow-[0_2px_16px_-2px_var(--color-accent-glow)] hover:-translate-y-px active:translate-y-0",
        outline:
          "border-border/50 bg-transparent text-fg-default hover:border-border hover:bg-bg-hover hover:shadow-sm aria-expanded:bg-bg-hover",
        secondary:
          "bg-bg-elevated text-fg-default border border-border/30 hover:bg-bg-hover hover:border-border/60 hover:shadow-sm aria-expanded:bg-bg-hover",
        ghost:
          "bg-transparent text-fg-muted hover:bg-bg-hover hover:text-fg-default aria-expanded:bg-bg-hover aria-expanded:text-fg-default",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:shadow-[0_0_12px_-4px_rgba(248,113,113,0.3)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
      },
      size: {
        default:
          "h-7 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-5 gap-1 rounded-md px-2 text-ui-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-6 gap-1 rounded-md px-2.5 text-ui-sm in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-8 gap-2 px-4 text-ui-md has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-7",
        "icon-xs":
          "size-5 rounded-md in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6 rounded-md in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
