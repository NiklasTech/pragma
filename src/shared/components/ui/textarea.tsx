import * as React from "react";

import { cn } from "@/shared/lib/utils";

import { useFieldLabel } from "./field-label";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const naming = useFieldLabel(props);
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-y rounded-[5px] bg-transparent px-3 py-2 text-ui-sm text-fg-default ring-1 ring-fg-default/15 ring-inset transition-[box-shadow,background-color] duration-(--motion-fast) ease-(--motion-ease) outline-none placeholder:text-fg-subtle hover:ring-fg-default/35 focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:ring-destructive/60",
        className,
      )}
      {...naming}
      {...props}
    />
  );
}

export { Textarea };
