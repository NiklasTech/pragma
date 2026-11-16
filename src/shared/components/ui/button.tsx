import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[5px] font-mono text-ui-xs font-medium whitespace-nowrap transition-[background-color,color,box-shadow,opacity] duration-(--motion-fast) ease-(--motion-ease) outline-none select-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:pointer-events-none disabled:opacity-40 aria-invalid:ring-2 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The one main action of a view.
        default:
          "bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:bg-control disabled:text-fg-subtle disabled:opacity-100",
        // Design D: a 1px frame, no fill; the frame brightens on hover.
        secondary:
          "bg-transparent text-fg-default ring-1 ring-fg-default/15 ring-inset hover:ring-fg-default/35 aria-expanded:ring-fg-default/35",
        outline:
          "bg-transparent text-fg-default ring-1 ring-fg-default/15 ring-inset hover:ring-fg-default/35 aria-expanded:ring-fg-default/35",
        ghost:
          "bg-transparent text-fg-muted hover:bg-bg-hover hover:text-fg-default aria-expanded:bg-bg-hover aria-expanded:text-fg-default",
        destructive:
          "bg-transparent text-destructive ring-1 ring-destructive/50 ring-inset hover:bg-destructive/10 focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-7 gap-2 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 has-data-[slot=kbd]:pr-1.5",
        xs: "h-5.5 gap-1 rounded-[4px] px-2 text-ui-2xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        sm: "h-6.5 gap-1.5 rounded-[5px] px-2.25 text-ui-xs has-data-[slot=kbd]:pr-1 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.75 has-data-[icon=inline-start]:pl-1.75",
        lg: "h-8 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-7 rounded-[7px]",
        "icon-xs": "size-5 rounded-[5px] in-data-[slot=button-group]:rounded-lg",
        "icon-sm": "size-6 rounded-[6px] in-data-[slot=button-group]:rounded-lg",
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
