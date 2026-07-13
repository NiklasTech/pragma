import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/shared/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-7 w-full min-w-0 rounded-lg border border-border/50 bg-bg-input px-3 py-1 text-ui-base text-fg-default transition-all duration-base outline-none file:inline-flex file:h-5 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-fg-default placeholder:text-fg-subtle/70 focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-primary/15 focus-visible:bg-bg-elevated disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-35 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
