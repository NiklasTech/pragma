import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-ui-sm text-fg-default transition-all duration-200 outline-none placeholder:text-fg-subtle focus-visible:border-primary/50 focus-visible:shadow-[0_0_0_3px_var(--color-accent-subtle)] disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 resize-y",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
