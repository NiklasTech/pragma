import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const chipVariants = cva(
  "inline-flex h-5.5 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-ui-xs whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-fg-default/[0.06] text-fg-muted",
        "needs-you": "bg-state-needs-you/15 font-medium text-state-needs-you",
        done: "bg-state-done/12 text-state-done",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

/** A short, non-interactive label: neutral facts, what needs you, or what is done. */
function Chip({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return (
    <span
      data-slot="chip"
      data-variant={variant ?? "neutral"}
      className={cn(chipVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
