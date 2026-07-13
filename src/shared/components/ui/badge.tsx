import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-[18px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent px-1.5 py-0 text-ui-xs font-medium whitespace-nowrap transition-all duration-base focus-visible:ring-2 focus-visible:ring-ring/40 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary/12 text-primary border-primary/20 [a]:hover:bg-primary/25",
        secondary: "bg-bg-elevated text-fg-default border border-border/30 [a]:hover:bg-bg-hover",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20 focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20",
        outline: "border-border/50 text-fg-muted [a]:hover:bg-bg-hover [a]:hover:text-fg-default",
        ghost: "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-status-success/10 text-status-success border-status-success/20 [a]:hover:bg-status-success/20",
        warning:
          "bg-status-warning/10 text-status-warning border-status-warning/20 [a]:hover:bg-status-warning/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
