import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-14 w-full rounded-lg border border-border/60 bg-bg-input px-3 py-2 text-ui-base text-fg-default transition-all duration-200 outline-none placeholder:text-fg-subtle focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 resize-y",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
