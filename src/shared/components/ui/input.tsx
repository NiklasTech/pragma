import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/shared/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-7.5 w-full min-w-0 rounded-[5px] bg-transparent px-2.5 py-1 text-ui-sm text-fg-default file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-ui-xs file:font-medium file:text-fg-default disabled:pointer-events-none ring-1 ring-fg-default/15 ring-inset transition-[box-shadow,background-color] duration-(--motion-fast) ease-(--motion-ease) outline-none placeholder:text-fg-subtle hover:ring-fg-default/35 focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:ring-destructive/60",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
