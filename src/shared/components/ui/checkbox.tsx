import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/shared/lib/utils";
import { Check } from "@phosphor-icons/react";

import { useFieldLabel } from "./field-label";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  const naming = useFieldLabel(props);
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[3px] bg-transparent ring-1 ring-fg-default/25 ring-inset transition-[background-color,box-shadow] duration-(--motion-fast) ease-(--motion-ease) outline-none group-has-disabled/field:opacity-40 after:absolute after:-inset-x-2 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:ring-destructive/60 data-checked:bg-primary data-checked:text-primary-foreground data-checked:ring-primary",
        className,
      )}
      {...naming}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3"
      >
        <Check weight="bold" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
