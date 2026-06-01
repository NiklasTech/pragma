import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-14 w-full rounded-md border border-input bg-input/40 px-2 py-1.5 text-[13px] transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 resize-y",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
