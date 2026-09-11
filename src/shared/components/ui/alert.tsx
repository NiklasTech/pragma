import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-md border border-border px-2.5 py-2 text-left text-ui-base has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-bg-elevated text-fg-default",
        destructive:
          "border-status-error/40 bg-status-error/10 text-status-error *:data-[slot=alert-description]:text-status-error",
        warning:
          "border-status-warning/40 bg-status-warning/10 text-status-warning *:data-[slot=alert-description]:text-status-warning",
        success:
          "border-status-success/40 bg-status-success/10 text-status-success *:data-[slot=alert-description]:text-status-success",
        info: "border-primary/30 bg-primary/10 text-primary *:data-[slot=alert-description]:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-fg-default",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-ui-sm text-balance text-fg-default md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-fg-default [&_p:not(:last-child)]:mb-3",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-1.5 right-1.5", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
