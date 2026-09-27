import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/shared/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-border bg-bg-input px-2.5 py-1 text-ui-sm text-fg-default transition-all duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-ui-xs file:font-medium file:text-fg-default placeholder:text-fg-subtle focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_3px_var(--color-accent-subtle)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
