import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-all duration-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/12 text-primary shadow-sm",
        secondary:
          "border-transparent bg-bg-elevated text-fg-default border border-border/30",
        destructive:
          "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        outline: "text-fg-muted border-border/50",
        success: "border-transparent bg-status-success/10 text-status-success border-status-success/20",
        warning: "border-transparent bg-status-warning/10 text-status-warning border-status-warning/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
